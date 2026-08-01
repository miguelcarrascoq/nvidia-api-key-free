'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { BenchmarkResult } from '@/lib/benchmark';
import {
  DEFAULT_MODEL_STORAGE_KEY,
  FALLBACK_DEFAULT_MODEL_ID,
  MODELS,
  type ModelDefinition,
} from '@/lib/models';

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

export function Playground({ apiKeyConfigured }: { apiKeyConfigured: boolean }) {
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

  paramsRef.current = {
    model: selectedModelId,
    temperature,
    topP,
    maxTokens,
    stream,
  };

  useEffect(() => {
    const stored = window.localStorage.getItem(DEFAULT_MODEL_STORAGE_KEY);
    if (stored && MODELS.some((model) => model.id === stored)) {
      setSelectedModelId(stored);
      setDefaultModelId(stored);
    }
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
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
          headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch('/api/benchmark', { method: 'POST' });
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

  return (
    <div className="playground">
      <header className="hero">
        <div className="brand-lockup">
          <p className="brand">NVIDIA NIM</p>
          <h1>Model Playground</h1>
        </div>
        <p className="lede">
          Pick a model, tune generation params, and stream responses through the
          NVIDIA Integrate API.
        </p>
        <div className="status-row">
          <span className={apiKeyConfigured ? 'pill ok' : 'pill bad'}>
            {apiKeyConfigured ? 'API key configured' : 'API key missing'}
          </span>
          <span className="pill muted">Default: {defaultModelId}</span>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Models</h2>
            <p>Select a model or benchmark the full list for live latency.</p>
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn secondary"
              onClick={runBenchmark}
              disabled={!apiKeyConfigured || benchStatus === 'running'}
            >
              {benchStatus === 'running' ? 'Testing latency…' : 'Test latency'}
            </button>
            {fastestOk ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => persistDefault(fastestOk.modelId)}
              >
                Use fastest as default
              </button>
            ) : null}
          </div>
        </div>

        {benchProgress ? (
          <p className="progress">
            Testing {benchProgress.index + 1}/{benchProgress.total}:{' '}
            <code>{benchProgress.modelId}</code>
          </p>
        ) : null}
        {benchError ? <p className="error">{benchError}</p> : null}

        <div className="model-grid">
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

      <section className="workspace">
        <form className="panel composer" onSubmit={handleSend}>
          <h2>Prompt</h2>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={6}
            placeholder="Ask anything…"
            disabled={!apiKeyConfigured}
          />

          <div className="controls">
            <label>
              <span>Temperature {temperature.toFixed(2)}</span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Top P {topP.toFixed(2)}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={topP}
                onChange={(event) => setTopP(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Max tokens {maxTokens}</span>
              <input
                type="range"
                min={16}
                max={2048}
                step={16}
                value={maxTokens}
                onChange={(event) => setMaxTokens(Number(event.target.value))}
              />
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={stream}
                onChange={(event) => setStream(event.target.checked)}
              />
              <span>Stream response</span>
            </label>
          </div>

          <div className="actions">
            <button
              type="submit"
              className="btn primary"
              disabled={!apiKeyConfigured || isChatBusy || !prompt.trim()}
            >
              {isChatBusy ? 'Running…' : 'Send'}
            </button>
            {status === 'streaming' || status === 'submitted' ? (
              <button type="button" className="btn secondary" onClick={() => stop()}>
                Stop
              </button>
            ) : null}
          </div>
        </form>

        <div className="panel response">
          <h2>Response</h2>
          <p className="meta">
            Model <code>{selectedModelId}</code>
          </p>
          {(error || nonStreamError) && (
            <p className="error">{error?.message || nonStreamError}</p>
          )}
          <div className="messages">
            {messages.length === 0 && !nonStreamReply ? (
              <p className="empty">Responses will appear here.</p>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={message.role === 'user' ? 'bubble user' : 'bubble assistant'}
                >
                  <header>{message.role === 'user' ? 'You' : 'Assistant'}</header>
                  <p>{messageText(message) || (status === 'streaming' ? '…' : '')}</p>
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
      className={[
        'model-card',
        selected ? 'selected' : '',
        isFastest ? 'fastest' : '',
        result && !result.ok ? 'failed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button type="button" className="model-select" onClick={onSelect}>
        <div className="model-top">
          <span className="vendor">{model.vendor}</span>
          {rank ? <span className="rank">#{rank}</span> : null}
        </div>
        <h3>{model.label}</h3>
        <code>{model.id}</code>
        <div className="latency">
          {result ? (
            result.ok ? (
              <span className="pill ok">{formatMs(result.latencyMs)}</span>
            ) : (
              <span className="pill bad">
                {result.status === 504 ? 'timeout' : 'error'}
              </span>
            )
          ) : (
            <span className="pill muted">not tested</span>
          )}
          {isDefault ? <span className="pill accent">default</span> : null}
          {isFastest ? <span className="pill accent">fastest</span> : null}
        </div>
        {result?.error ? <p className="card-error">{result.error}</p> : null}
      </button>
      <button
        type="button"
        className="btn tiny"
        onClick={onSetDefault}
        disabled={!canSetDefault}
      >
        Set as default
      </button>
    </article>
  );
}
