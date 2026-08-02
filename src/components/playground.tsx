'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Check, ChevronRight, Copy, Loader2, Pin } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiKeySetup } from '@/components/api-key-setup';
import { MarkdownContent } from '@/components/markdown-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import type { BenchmarkResult } from '@/lib/benchmark';
import {
  DEFAULT_GENERATION_PARAMS,
  GENERATION_PRESETS,
  matchGenerationPreset,
  type GenerationParams,
} from '@/lib/generation-presets';
import {
  DEFAULT_MODEL_STORAGE_KEY,
  FALLBACK_DEFAULT_MODEL_ID,
  MODELS,
  type ModelDefinition,
} from '@/lib/models';
import { NVIDIA_API_KEY_HEADER } from '@/lib/api-key-header';
import { nextSamplePrompt, SAMPLE_PROMPTS } from '@/lib/sample-prompts';
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

const COLLAPSE_MS = 700;

function CollapsibleContent({
  open,
  children,
  className,
  id,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const skipTransitionRef = useRef(true);
  const [height, setHeight] = useState(0);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    if (skipTransitionRef.current) {
      skipTransitionRef.current = false;
      setHeight(open ? el.scrollHeight : 0);
      return;
    }

    setAnimate(true);
    setHeight(open ? el.scrollHeight : 0);
  }, [open]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el || !open) return;

    const syncHeight = () => setHeight(el.scrollHeight);
    const observer = new ResizeObserver(syncHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  return (
    <div
      id={id}
      className="overflow-hidden motion-reduce:!transition-none"
      style={{
        height,
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(0)' : 'translateY(-10px)',
        transition: animate
          ? `height ${COLLAPSE_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${COLLAPSE_MS}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${COLLAPSE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
          : 'none',
      }}
      inert={!open}
    >
      <div ref={innerRef} className={className}>
        {children}
      </div>
    </div>
  );
}

function AssistantLoadingCard() {
  return (
    <article
      className="rounded-xl border border-primary/28 bg-[rgba(5,10,8,0.55)] px-4 py-3.5"
      aria-busy
    >
      <header className="mb-1.5 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-muted-foreground">
        Assistant
        <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
      </header>
      <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
        Generating response…
      </p>
    </article>
  );
}

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
  const [temperature, setTemperature] = useState(
    DEFAULT_GENERATION_PARAMS.temperature,
  );
  const [topP, setTopP] = useState(DEFAULT_GENERATION_PARAMS.topP);
  const [maxTokens, setMaxTokens] = useState(DEFAULT_GENERATION_PARAMS.maxTokens);
  const [stream, setStream] = useState(true);
  const [nonStreamReply, setNonStreamReply] = useState<string | null>(null);
  const [nonStreamPending, setNonStreamPending] = useState(false);
  const [nonStreamError, setNonStreamError] = useState<string | null>(null);
  const [paramsOpen, setParamsOpen] = useState(true);
  const [modelsOpen, setModelsOpen] = useState(true);
  const [responseCopied, setResponseCopied] = useState(false);

  const [benchStatus, setBenchStatus] = useState<BenchStatus>('idle');
  const [benchProgress, setBenchProgress] = useState<{
    completed: number;
    total: number;
    activeModelIds: string[];
  } | null>(null);
  const [benchResults, setBenchResults] = useState<Record<string, BenchmarkResult>>(
    {},
  );
  const [benchError, setBenchError] = useState<string | null>(null);

  const responsePanelRef = useRef<HTMLDivElement>(null);
  const responseEndRef = useRef<HTMLDivElement>(null);
  const samplePromptDeckRef = useRef<string[]>([]);
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

  const { messages, sendMessage, status, stop, setMessages, error, clearError } =
    useChat({
      transport,
    });

  const isChatBusy = status === 'submitted' || status === 'streaming' || nonStreamPending;
  const isStreaming = status === 'submitted' || status === 'streaming';
  const wasChatBusyRef = useRef(false);
  const hasResponse =
    messages.length > 0 || Boolean(nonStreamReply) || Boolean(error || nonStreamError);
  const latestMessageText =
    messages.length > 0 ? messageText(messages[messages.length - 1]!) : '';
  const fullResponseText = useMemo(() => {
    const assistantTexts = messages
      .filter((message) => message.role === 'assistant')
      .map(messageText)
      .filter(Boolean);
    if (assistantTexts.length > 0) return assistantTexts.join('\n\n');
    return nonStreamReply?.trim() ?? '';
  }, [messages, nonStreamReply]);
  const canCopyResponse = Boolean(fullResponseText) && !isChatBusy;

  useEffect(() => {
    setParamsOpen(!hasResponse);
  }, [hasResponse]);

  useEffect(() => {
    if (!responseCopied) return;
    const timer = window.setTimeout(() => setResponseCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [responseCopied]);

  function clearResponse() {
    if (isChatBusy) return;
    setMessages([]);
    clearError();
    setNonStreamReply(null);
    setNonStreamError(null);
    setResponseCopied(false);
  }

  async function copyResponse() {
    if (!canCopyResponse) return;
    try {
      await navigator.clipboard.writeText(fullResponseText);
      setResponseCopied(true);
    } catch {
      setResponseCopied(false);
    }
  }

  function scrollResponseIntoView() {
    responsePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollResponseEndIntoView(behavior: ScrollBehavior = 'auto') {
    responseEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }

  // Follow newly streamed tokens so the latest content stays in view.
  useEffect(() => {
    if (!isStreaming) return;
    const id = window.requestAnimationFrame(() => {
      scrollResponseEndIntoView('auto');
    });
    return () => window.cancelAnimationFrame(id);
  }, [isStreaming, latestMessageText, messages.length]);

  useEffect(() => {
    if (wasChatBusyRef.current && !isChatBusy && hasResponse) {
      // Wait a frame so the final message content is laid out before scrolling.
      const id = window.requestAnimationFrame(() => {
        scrollResponseEndIntoView('smooth');
      });
      wasChatBusyRef.current = isChatBusy;
      return () => window.cancelAnimationFrame(id);
    }
    wasChatBusyRef.current = isChatBusy;
  }, [isChatBusy, hasResponse]);

  const activePreset = matchGenerationPreset({ temperature, topP, maxTokens });

  function applyGenerationParams(params: GenerationParams) {
    setTemperature(params.temperature);
    setTopP(params.topP);
    setMaxTokens(params.maxTokens);
  }

  function pickRandomPrompt() {
    const { prompt: nextPrompt, deck } = nextSamplePrompt(
      samplePromptDeckRef.current,
      SAMPLE_PROMPTS,
    );
    samplePromptDeckRef.current = deck;
    setPrompt(nextPrompt);
  }

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

  const selectedModel =
    MODELS.find((model) => model.id === selectedModelId) ?? MODELS[0];
  const selectedBenchResult = benchResults[selectedModelId];

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
    scrollResponseIntoView();

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
            | {
                type: 'progress';
                modelId: string;
                active: boolean;
                completed: number;
                total: number;
              }
            | {
                type: 'result';
                completed: number;
                total: number;
                result: BenchmarkResult;
              }
            | { type: 'done' };

          if (event.type === 'start') {
            setBenchProgress({
              completed: 0,
              total: event.total,
              activeModelIds: [],
            });
          }

          if (event.type === 'progress' && event.active) {
            setBenchProgress((prev) => ({
              completed: event.completed,
              total: event.total,
              activeModelIds: [
                ...(prev?.activeModelIds ?? []).filter(
                  (id) => id !== event.modelId,
                ),
                event.modelId,
              ],
            }));
          }

          if (event.type === 'result') {
            setBenchResults((prev) => ({
              ...prev,
              [event.result.modelId]: event.result,
            }));
            setBenchProgress((prev) => ({
              completed: event.completed,
              total: event.total,
              activeModelIds: (prev?.activeModelIds ?? []).filter(
                (id) => id !== event.result.modelId,
              ),
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
        <div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={modelsOpen}
              aria-controls="models-panel"
              onClick={() => setModelsOpen((open) => !open)}
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  aria-hidden
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform duration-700 ease-in-out motion-reduce:transition-none',
                    modelsOpen && 'rotate-90',
                  )}
                />
                <h2 className="m-0 text-lg font-semibold">Models</h2>
              </div>
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="truncate font-medium text-foreground">
                  {selectedModel.label}
                </span>
                <code className="max-w-[16rem] truncate text-xs text-accent-2">
                  {selectedModel.id}
                </code>
                {selectedModelId === defaultModelId ? (
                  <Badge
                    variant="outline"
                    className="border-accent-2/35 text-accent-2"
                  >
                    default
                  </Badge>
                ) : null}
                {selectedBenchResult?.ok ? (
                  <Badge variant="outline" className="border-ok/35 text-ok">
                    {formatMs(selectedBenchResult.latencyMs)}
                  </Badge>
                ) : null}
              </div>
            </button>
            <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runBenchmark}
                disabled={!apiKeyConfigured || benchStatus === 'running'}
                className="max-md:flex-1"
              >
                {benchStatus === 'running' ? 'Testing…' : 'Test latency'}
              </Button>
              {fastestOk ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => persistDefault(fastestOk.modelId)}
                  className="max-md:flex-1"
                >
                  Use fastest as default
                </Button>
              ) : null}
            </div>
          </div>

          <CollapsibleContent open={modelsOpen} className="mt-4" id="models-panel">
            <p className="mt-0 mb-3 text-sm text-muted-foreground">
              Select a model or benchmark the list for live latency.
            </p>

            {benchStatus === 'running' ? (
              <div
                className="mb-3 grid gap-2 rounded-xl border border-border bg-[rgba(5,10,8,0.55)] p-3"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-foreground">
                    Testing latency
                    {benchProgress
                      ? ` · ${benchProgress.completed} of ${benchProgress.total}`
                      : '…'}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {benchProgress && benchProgress.total > 0
                      ? `${Math.round(
                          (benchProgress.completed / benchProgress.total) * 100,
                        )}%`
                      : '0%'}
                  </span>
                </div>
                <Progress
                  value={
                    benchProgress && benchProgress.total > 0
                      ? (benchProgress.completed / benchProgress.total) * 100
                      : 0
                  }
                  className="h-2 bg-secondary"
                />
                {benchProgress && benchProgress.activeModelIds.length > 0 ? (
                  <p className="m-0 truncate text-xs text-muted-foreground">
                    In progress:{' '}
                    <code className="text-accent-2">
                      {benchProgress.activeModelIds.join(', ')}
                    </code>
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

            <div className="grid gap-1.5">
              {orderedModels.map(({ model, result }, rank) => (
                <ModelRow
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
          </CollapsibleContent>
        </div>
      </section>

      <section className="grid gap-4 animate-rise [animation-delay:200ms]">
        <form
          className={cn(panelClass, 'flex flex-col [animation-delay:200ms]')}
          onSubmit={handleSend}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-lg font-semibold">Prompt</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pickRandomPrompt}
            >
              Random question
            </Button>
          </div>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={6}
            placeholder="Ask anything…"
            disabled={!apiKeyConfigured}
            className="mt-3.5 min-h-[150px] resize-y rounded-xl bg-[rgba(5,10,8,0.8)] px-4 py-3.5 text-base leading-relaxed"
          />

          <div className="my-4 rounded-xl border border-border/80 bg-[rgba(5,10,8,0.35)] px-3.5 py-2.5">
            <button
              type="button"
              className="flex w-full cursor-pointer select-none items-center gap-2 rounded-md text-left text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={paramsOpen}
              aria-controls="params-panel"
              onClick={() => setParamsOpen((open) => !open)}
            >
              <ChevronRight
                aria-hidden
                className={cn(
                  'size-3.5 shrink-0 transition-transform duration-700 ease-in-out motion-reduce:transition-none',
                  paramsOpen && 'rotate-90',
                )}
              />
              <span>
                Parameters
                {activePreset ? (
                  <span className="ml-2 font-normal text-muted-foreground/80">
                    · {activePreset.label}
                  </span>
                ) : (
                  <span className="ml-2 font-normal text-muted-foreground/80">
                    · Custom
                  </span>
                )}
              </span>
            </button>
            <CollapsibleContent open={paramsOpen} className="mt-3.5" id="params-panel">
              <div className="grid gap-3.5">
                <div className="grid gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Preset</span>
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Generation presets"
                  >
                    {GENERATION_PRESETS.map((preset) => {
                      const isActive = activePreset?.id === preset.id;
                      return (
                        <Button
                          key={preset.id}
                          type="button"
                          size="sm"
                          variant={isActive ? 'default' : 'outline'}
                          aria-pressed={isActive}
                          onClick={() => applyGenerationParams(preset)}
                        >
                          {preset.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="m-0 text-xs text-muted-foreground">
                    {activePreset?.description ?? 'Custom — sliders adjusted manually.'}
                  </p>
                </div>
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
            </CollapsibleContent>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="submit"
              disabled={!apiKeyConfigured || isChatBusy || !prompt.trim()}
              className="max-md:flex-1"
              aria-busy={isChatBusy}
            >
              {isChatBusy ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Running…
                </>
              ) : (
                'Send'
              )}
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

        <div
          ref={responsePanelRef}
          className={cn(panelClass, 'min-h-[220px] scroll-mt-4 [animation-delay:240ms]')}
        >
          <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-1 border-b border-border/70 bg-bg-2/95 px-5 pt-5 pb-3 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <h2 className="m-0 text-lg font-semibold">Response</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyResponse}
                  disabled={!canCopyResponse}
                  aria-label={responseCopied ? 'Copied' : 'Copy full response'}
                >
                  {responseCopied ? <Check /> : <Copy />}
                  {responseCopied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearResponse}
                  disabled={!hasResponse || isChatBusy}
                >
                  Clear
                </Button>
              </div>
            </div>
            <p className="mt-1.5 mb-0 text-sm text-muted-foreground">
              Model{' '}
              <code className="text-accent-2 break-all">{selectedModelId}</code>
            </p>
          </div>
          {(error || nonStreamError) && (
            <p className="mt-3 mb-0 text-destructive">
              {error?.message || nonStreamError}
            </p>
          )}
          <div className="mt-4 grid gap-3">
            {messages.length === 0 && !nonStreamReply ? (
              nonStreamPending ? (
                <AssistantLoadingCard />
              ) : (
                <p className="m-0 text-sm text-muted-foreground">
                  Responses will appear here.
                </p>
              )
            ) : (
              <>
                {messages.map((message, index) => {
                  const text = messageText(message);
                  const isLastMessage = index === messages.length - 1;
                  const isAssistantStreaming =
                    message.role === 'assistant' &&
                    isLastMessage &&
                    (status === 'submitted' || status === 'streaming');
                  const isAssistantLoading = isAssistantStreaming && !text;

                  if (isAssistantLoading) {
                    return <AssistantLoadingCard key={message.id} />;
                  }

                  return (
                    <article
                      key={message.id}
                      className={cn(
                        'rounded-xl border bg-[rgba(5,10,8,0.55)] px-4 py-3.5',
                        message.role === 'user'
                          ? 'border-accent-2/22'
                          : 'border-primary/28',
                      )}
                      aria-busy={isAssistantStreaming || undefined}
                    >
                      <header className="mb-1.5 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                        {message.role === 'user' ? 'You' : 'Assistant'}
                        {isAssistantStreaming ? (
                          <Loader2
                            className="size-3.5 animate-spin text-primary"
                            aria-hidden
                          />
                        ) : null}
                      </header>
                      {text ? <MarkdownContent content={text} /> : null}
                      {isAssistantStreaming && text ? (
                        <p
                          className="mt-3 mb-0 flex items-center gap-2 text-sm text-muted-foreground"
                          aria-live="polite"
                        >
                          <Loader2
                            className="size-4 animate-spin text-primary"
                            aria-hidden
                          />
                          Generating response…
                        </p>
                      ) : null}
                    </article>
                  );
                })}
                {isChatBusy &&
                messages.length > 0 &&
                messages[messages.length - 1]?.role === 'user' ? (
                  <AssistantLoadingCard />
                ) : null}
              </>
            )}
            <div ref={responseEndRef} className="h-px w-full" aria-hidden />
          </div>
        </div>
      </section>
    </div>
  );
}

function ModelRow({
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
  const showSetDefault = selected && !isDefault && canSetDefault;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border border-border bg-[rgba(7,17,12,0.55)] px-3 py-2 transition-[border-color,background] duration-200 hover:border-primary/40',
        selected && 'border-primary bg-primary/8',
        isFastest && 'shadow-[inset_0_0_0_1px_rgba(183,255,60,0.35)]',
        result && !result.ok && 'opacity-[0.78]',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left text-inherit outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {rank ? (
          <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">
            #{rank}
          </span>
        ) : null}
        <span className="hidden w-[5.5rem] shrink-0 truncate text-xs uppercase tracking-[0.06em] text-muted-foreground sm:block">
          {model.vendor}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {model.label}
          </span>
          <code
            className="block truncate text-[0.7rem] text-accent-2"
            title={model.id}
          >
            {model.id}
          </code>
        </span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {result ? (
            result.ok ? (
              <Badge variant="outline" className="border-ok/35 text-ok">
                {formatMs(result.latencyMs)}
              </Badge>
            ) : (
              <Badge
                variant="destructive"
                title={result.error ?? undefined}
              >
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
        </span>
      </button>
      {showSetDefault ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onSetDefault}
          className="shrink-0"
          aria-label={`Set ${model.label} as default`}
        >
          <Pin data-icon="inline-start" className="size-3.5" />
          Set default
        </Button>
      ) : null}
    </div>
  );
}
