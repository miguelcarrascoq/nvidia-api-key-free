'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApiKeyStore } from '@/store/api-key';

type ApiKeySetupProps = {
  open: boolean;
  onClose?: () => void;
  allowDismiss?: boolean;
};

export function ApiKeySetup({
  open,
  onClose,
  allowDismiss = false,
}: ApiKeySetupProps) {
  const apiKey = useApiKeyStore((state) => state.apiKey);
  const setApiKey = useApiKeyStore((state) => state.setApiKey);
  const clearApiKey = useApiKeyStore((state) => state.clearApiKey);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(apiKey);
    }
  }, [open, apiKey]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && allowDismiss) {
      onClose?.();
    }
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (!next) return;
    setApiKey(next);
    onClose?.();
  }

  function handleClear() {
    clearApiKey();
    setDraft('');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={allowDismiss}
        className="gap-5 p-5 sm:max-w-lg"
        onInteractOutside={(event) => {
          if (!allowDismiss) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (!allowDismiss) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">Your NVIDIA API key</DialogTitle>
          <DialogDescription>
            This app does not ship with a shared key. Use your own — it is stored
            only in this browser.
          </DialogDescription>
        </DialogHeader>

        <ol className="m-0 grid list-decimal gap-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            Go to{' '}
            <a
              href="https://build.nvidia.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-3 hover:underline"
            >
              build.nvidia.com
            </a>
          </li>
          <li>Sign in or create an NVIDIA account</li>
          <li>
            Open a model or your profile and click{' '}
            <strong className="font-semibold text-foreground">Get API Key</strong> /{' '}
            <strong className="font-semibold text-foreground">Generate Key</strong>
          </li>
          <li>
            Copy the key (starts with <code>nvapi-</code>) and paste it below
          </li>
        </ol>

        <form className="grid gap-4" onSubmit={handleSave}>
          <div className="grid gap-2">
            <Label htmlFor="api-key">API key</Label>
            <Input
              id="api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="nvapi-…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-10 font-mono text-sm"
            />
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0 sm:justify-start">
            <Button type="submit" disabled={!draft.trim()}>
              Save in this browser
            </Button>
            {apiKey ? (
              <Button type="button" variant="outline" onClick={handleClear}>
                Clear key
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
