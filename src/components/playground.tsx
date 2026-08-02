'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ApiKeySetup } from '@/components/api-key-setup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import type { BenchmarkResult } from '@/lib/benchmark';
import {
  DEFAULT_MODEL_STORAGE_KEY,
  FALLBACK_DEFAULT_MODEL_ID,
  MODELS,
  type ModelDefinition,
} from '@/lib/models';
import { NVIDIA_API_KEY_HEADER } from '@/lib/api-key-header';
import { useApiKeyStore } from '@/store/api-key';
import { cn } from '@/lib/utils';

type BenchStatus = 'idle' | 'running' | 'done' | 'error';

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

const panelClass =
  'rounded-2xl border border-border bg-bg-2 p-5 shadow-[var(--shadow)] animate-rise';

export function Playground() {
  const apiKey = useApiKeyStore((state) => state.apiKey);
  const hasHydrated = useApiKeyStore((state) => state.hasHydrated);
  const apiKeyConfigured = Boolean(apiKey.trim());

  useEffect(() => {
    // Ensure UI unlocks even if persist hydration callback is skipped.
    const id = window.setTimeout(() => {
      if (!useApiKeyStore.getState().hasHydrated) {
        useApiKeyStore.setState({ hasHydrated: true });
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(FALLBACK_DEFAULT_MODEL_ID);
  const [defaultModelId, setDefaultModelId] = useState(FALLBACK_DEFAULT_MODEL_ID);
  const [prompt, setPrompt] = useState(
    'In one short sentence: how do I kill a process in Linux?',
  );
  const [temperature, setTemperature] = useState(0.2);
  const [topP, setTopP] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [stream, setStream] = useState(true);
  const [nonStreamReply, setNonStreamReply] = useState<string | null>(null);
  const [nonStreamPending, setNonStreamPending] = useState(false);
  const [nonStreamError, setNonStreamError] = useState<string | null>(null);

  const [benchStatus, setBenchStatus] = useState<BenchStatus>('idle');
  const [benchProgress, setBenchProgress] = useState<{
    index: number;
    total: number;
    modelId: string;
  } | null>(null);
  const [benchResults, setBenchResults] = useState<Record<string, BenchmarkResult>>(
    {},
  );
  const [benchError, setBenchError] = useState<string | null>(null);

  const paramsRef = useRef({
    model: selectedModelId,
    temperature,
    topP,
    maxTokens,
    stream,
  });
  const apiKeyRef = useRef(apiKey);

  paramsRef.current = {
    model: selectedModelId,
    temperature,
    topP,
    maxTokens,
    stream,
  };
  apiKeyRef.current = apiKey;

  useEffect(() => {
    const stored = window.localStorage.getItem(DEFAULT_MODEL_STORAGE_KEY);
    if (stored && MODELS.some((model) => model.id === stored)) {
      setSelectedModelId(stored);
      setDefaultModelId(stored);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!apiKeyConfigured) {
      setKeyModalOpen(true);
    }
  }, [hasHydrated, apiKeyConfigured]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: () => ({
          [NVIDIA_API_KEY_HEADER]: apiKeyRef.current,
        }),
        body: () => ({
          model: paramsRef.current.model,
          temperature: paramsRef.current.temperature,
          topP: paramsRef.current.topP,
          maxTokens: paramsRef.current.maxTokens,
          stream: true,
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop, setMessages, error } = useChat({
    transport,
  });

  const isChatBusy = status === 'submitted' || status === 'streaming' || nonStreamPending;

  const orderedModels = useMemo(() => {
    const withLatency = MODELS.map((model) => ({
      model,
      result: benchResults[model.id],
    }));

    const hasResults = Object.keys(benchResults).length > 0;
    if (!hasResults) return withLatency;

    return [...withLatency].sort((a, b) => {
      const aOk = a.result?.ok ? 0 : 1;
      const bOk = b.result?.ok ? 0 : 1;
      if (aOk !== bOk) return aOk - bOk;

      const aMs = a.result?.ok ? (a.result.latencyMs ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      const bMs = b.result?.ok ? (b.result.latencyMs ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      return aMs - bMs;
    });
  }, [benchResults]);

  const fastestOk = useMemo(() => {
    return (
      Object.values(benchResults)
        .filter((result) => result.ok && result.latencyMs != null)
        .sort((a, b) => (a.latencyMs ?? 0) - (b.latencyMs ?? 0))[0] ?? null
    );
  }, [benchResults]);

  function persistDefault(modelId: string) {
    window.localStorage.setItem(DEFAULT_MODEL_STORAGE_KEY, modelId);
    setDefaultModelId(modelId);
    setSelectedModelId(modelId);
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || isChatBusy || !apiKeyConfigured) return;

    setNonStreamError(null);

    if (!stream) {
      setNonStreamPending(true);
      setNonStreamReply(null);
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [NVIDIA_API_KEY_HEADER]: apiKey,
          },
          body: JSON.stringify({
            messages: [
              {
                id: crypto.randomUUID(),
                role: 'user',
                parts: [{ type: 'text', text }],
              },
            ],
            model: selectedModelId,
            temperature,
            topP,
            maxTokens,
            stream: false,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Request failed (${response.status})`);
        }

        setMessages([
          {
            id: crypto.randomUUID(),
            role: 'user',
            parts: [{ type: 'text', text }],
          },
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            parts: [{ type: 'text', text: data.text }],
          },
        ]);
        setNonStreamReply(data.text);
        setPrompt('');
      } catch (err) {
        setNonStreamError(err instanceof Error ? err.message : 'Request failed');
      } finally {
        setNonStreamPending(false);
      }
      return;
    }

    setNonStreamReply(null);
    await sendMessage({ text });
    setPrompt('');
  }

  async function runBenchmark() {
    if (benchStatus === 'running' || !apiKeyConfigured) return;

    setBenchStatus('running');
    setBenchError(null);
    setBenchResults({});
    setBenchProgress(null);

    try {
      const response = await fetch('/api/benchmark', {
        method: 'POST',
        headers: {
          [NVIDIA_API_KEY_HEADER]: apiKey,
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Benchmark failed (${response.status})`);
      }

      if (!response.body) {
        throw new Error('No benchmark stream received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: 'start'; total: number }
            | { type: 'progress'; index: number; total: number; modelId: string }
            | { type: 'result'; result: BenchmarkResult }
            | { type: 'done' };

          if (event.type === 'progress') {
            setBenchProgress({
              index: event.index,
              total: event.total,
              modelId: event.modelId,
            });
          }

          if (event.type === 'result') {
            setBenchResults((prev) => ({
              ...prev,
              [event.result.modelId]: event.result,
            }));
          }
        }
      }

      setBenchStatus('done');
      setBenchProgress(null);
    } catch (err) {
      setBenchStatus('error');
      setBenchError(err instanceof Error ? err.message : 'Benchmark failed');
      setBenchProgress(null);
    }
  }

  const showBlockingSetup = hasHydrated && !apiKeyConfigured;

  return (
    <div className="relative mx-auto grid w-[min(1120px,calc(100%-2rem))] gap-6 py-10 pb-16">
      <ApiKeySetup
        open={keyModalOpen || showBlockingSetup}
        allowDismiss={apiKeyConfigured}
        onClose={() => setKeyModalOpen(false)}
      />

      <header className="grid min-h-[min(72vh,34rem)] content-center gap-5 animate-rise">
        <div className="grid gap-3">
          <h1 className="m-0 text-[clamp(2.75rem,9vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-foreground">
            NVIDIA NIM
            <span
              aria-hidden
              className="mt-3 block h-1 w-24 origin-left rounded-full bg-primary animate-[brand-line_0.9s_ease_0.2s_both]"
            />
          </h1>
          <p className="m-0 text-xl font-medium tracking-tight text-primary md:text-2xl">
            Model Playground
          </p>
        </div>
        <p className="m-0 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Pick a model, tune generation params, and stream responses through the
          NVIDIA Integrate API.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="lg"
            onClick={() => setKeyModalOpen(true)}
            disabled={!hasHydrated}
            className="max-md:w-full"
          >
            {apiKeyConfigured ? 'Change API key' : 'Set API key'}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2.5 border-y border-border/80 py-3 animate-rise [animation-delay:80ms]">
        <Badge
          variant="outline"
          className={cn(
            !hasHydrated && 'border-border text-muted-foreground',
            hasHydrated &&
              apiKeyConfigured &&
              'border-ok/35 text-ok',
            hasHydrated &&
              !apiKeyConfigured &&
              'border-destructive/35 text-destructive',
          )}
        >
          {!hasHydrated
            ? 'Checking API key…'
            : apiKeyConfigured
              ? 'API key configured'
              : 'API key missing'}
        </Badge>
        <Badge variant="secondary" className="max-w-full truncate font-mono text-[0.7rem]">
          Default: {defaultModelId}
        </Badge>
      </div>

      <section className={cn(panelClass, '[animation-delay:120ms]')}>
        <div className="mb-4 flex flex-col items-start justify-between gap-4 md:flex-row">
          <div>
            <h2 className="m-0 text-lg font-semibold">Models</h2>
            <p className="mt-1.5 mb-0 text-sm text-muted-foreground md:text-[0.95rem]">
              Coding models from NVIDIA Build — select one or benchmark the full
              list for live latency.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={runBenchmark}
              disabled={!apiKeyConfigured || benchStatus === 'running'}
              className="max-md:flex-1"
            >
              {benchStatus === 'running' ? 'Testing latency…' : 'Test latency'}
            </Button>
            {fastestOk ? (
              <Button
                type="button"
                onClick={() => persistDefault(fastestOk.modelId)}
                className="max-md:flex-1"
              >
                Use fastest as default
              </Button>
            ) : null}
          </div>
        </div>

        {benchStatus === 'running' ? (
          <div
            className="mb-4 grid gap-2 rounded-xl border border-border bg-[rgba(5,10,8,0.55)] p-3"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">
                Testing latency
                {benchProgress
                  ? ` · ${benchProgress.index + 1} of ${benchProgress.total}`
                  : '…'}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {benchProgress
                  ? `${Math.round(
                      ((benchProgress.index + 1) / benchProgress.total) * 100,
                    )}%`
                  : '0%'}
              </span>
            </div>
            <Progress
              value={
                benchProgress
                  ? ((benchProgress.index + 1) / benchProgress.total) * 100
                  : 0
              }
              className="h-2 bg-secondary"
            />
            {benchProgress ? (
              <p className="m-0 truncate text-xs text-muted-foreground">
                Current model:{' '}
                <code className="text-accent-2">{benchProgress.modelId}</code>
              </p>
            ) : (
              <p className="m-0 text-xs text-muted-foreground">
                Starting benchmark…
              </p>
            )}
          </div>
        ) : null}
        {benchError ? (
          <p className="mt-0 mb-3 text-destructive">{benchError}</p>
        ) : null}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
          {orderedModels.map(({ model, result }, rank) => (
            <ModelCard
              key={model.id}
              model={model}
              selected={selectedModelId === model.id}
              isDefault={defaultModelId === model.id}
              result={result}
              rank={Object.keys(benchResults).length ? rank + 1 : null}
              isFastest={fastestOk?.modelId === model.id}
              onSelect={() => setSelectedModelId(model.id)}
              onSetDefault={() => {
                if (result && !result.ok) return;
                persistDefault(model.id);
              }}
              canSetDefault={!result || result.ok}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1.05fr_0.95fr] animate-rise [animation-delay:200ms]">
        <form
          className={cn(panelClass, 'flex min-h-[420px] flex-col [animation-delay:200ms]')}
          onSubmit={handleSend}
        >
          <h2 className="m-0 text-lg font-semibold">Prompt</h2>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={6}
            placeholder="Ask anything…"
            disabled={!apiKeyConfigured}
            className="mt-3.5 min-h-[150px] flex-1 resize-y rounded-xl bg-[rgba(5,10,8,0.8)] px-4 py-3.5 text-base leading-relaxed"
          />

          <div className="my-4 grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="temperature" className="text-muted-foreground font-medium">
                Temperature {temperature.toFixed(2)}
              </Label>
              <input
                id="temperature"
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="top-p" className="text-muted-foreground font-medium">
                Top P {topP.toFixed(2)}
              </Label>
              <input
                id="top-p"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={topP}
                onChange={(event) => setTopP(Number(event.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="max-tokens" className="text-muted-foreground font-medium">
                Max tokens {maxTokens}
              </Label>
              <input
                id="max-tokens"
                type="range"
                min={16}
                max={2048}
                step={16}
                value={maxTokens}
                onChange={(event) => setMaxTokens(Number(event.target.value))}
              />
            </div>
            <Label
              htmlFor="stream"
              className="grid grid-cols-[auto_1fr] items-center gap-2.5 text-muted-foreground font-medium"
            >
              <input
                id="stream"
                type="checkbox"
                checked={stream}
                onChange={(event) => setStream(event.target.checked)}
              />
              <span>Stream response</span>
            </Label>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="submit"
              disabled={!apiKeyConfigured || isChatBusy || !prompt.trim()}
              className="max-md:flex-1"
            >
              {isChatBusy ? 'Running…' : 'Send'}
            </Button>
            {status === 'streaming' || status === 'submitted' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => stop()}
                className="max-md:flex-1"
              >
                Stop
              </Button>
            ) : null}
          </div>
        </form>

        <div className={cn(panelClass, 'min-h-[420px] [animation-delay:240ms]')}>
          <h2 className="m-0 text-lg font-semibold">Response</h2>
          <p className="mt-1.5 mb-0 text-sm text-muted-foreground">
            Model{' '}
            <code className="text-accent-2 break-all">{selectedModelId}</code>
          </p>
          {(error || nonStreamError) && (
            <p className="mt-3 mb-0 text-destructive">
              {error?.message || nonStreamError}
            </p>
          )}
          <div className="mt-4 grid gap-3">
            {messages.length === 0 && !nonStreamReply ? (
              <p className="m-0 text-sm text-muted-foreground">
                Responses will appear here.
              </p>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    'rounded-xl border bg-[rgba(5,10,8,0.55)] px-4 py-3.5',
                    message.role === 'user'
                      ? 'border-accent-2/22'
                      : 'border-primary/28',
                  )}
                >
                  <header className="mb-1.5 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </header>
                  <p className="m-0 whitespace-pre-wrap leading-relaxed">
                    {messageText(message) || (status === 'streaming' ? '…' : '')}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ModelCard({
  model,
  selected,
  isDefault,
  result,
  rank,
  isFastest,
  onSelect,
  onSetDefault,
  canSetDefault,
}: {
  model: ModelDefinition;
  selected: boolean;
  isDefault: boolean;
  result?: BenchmarkResult;
  rank: number | null;
  isFastest: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
  canSetDefault: boolean;
}) {
  return (
    <article
      className={cn(
        'grid gap-2.5 rounded-2xl border border-border bg-[rgba(7,17,12,0.55)] p-3.5 transition-[border-color,transform,background] duration-200 hover:-translate-y-0.5 hover:border-primary/40',
        selected && 'border-primary bg-primary/8',
        isFastest && 'shadow-[inset_0_0_0_1px_rgba(183,255,60,0.35)]',
        result && !result.ok && 'opacity-[0.78]',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="grid cursor-pointer gap-1.5 border-0 bg-transparent p-0 text-left text-inherit outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {model.vendor}
          </span>
          <Badge
            variant="outline"
            className="border-accent-2/28 text-accent-2 lowercase tracking-wide"
          >
            {model.useCase}
          </Badge>
          {rank ? (
            <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              #{rank}
            </span>
          ) : null}
        </div>
        <h3 className="m-0 text-[1.05rem] font-semibold">{model.label}</h3>
        <code className="text-accent-2 break-all">{model.id}</code>
        <div className="flex flex-wrap items-center gap-2">
          {result ? (
            result.ok ? (
              <Badge variant="outline" className="border-ok/35 text-ok">
                {formatMs(result.latencyMs)}
              </Badge>
            ) : (
              <Badge variant="destructive">
                {result.status === 504 ? 'timeout' : 'error'}
              </Badge>
            )
          ) : (
            <Badge variant="secondary">not tested</Badge>
          )}
          {isDefault ? (
            <Badge variant="outline" className="border-accent-2/35 text-accent-2">
              default
            </Badge>
          ) : null}
          {isFastest ? (
            <Badge variant="outline" className="border-accent-2/35 text-accent-2">
              fastest
            </Badge>
          ) : null}
        </div>
        {result?.error ? (
          <p className="m-0 text-xs leading-snug text-destructive">{result.error}</p>
        ) : null}
      </button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={onSetDefault}
        disabled={!canSetDefault}
      >
        Set as default
      </Button>
    </article>
  );
}
