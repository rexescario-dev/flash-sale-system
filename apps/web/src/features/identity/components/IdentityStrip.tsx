import { useEffect, useRef, useState } from 'react';

import { isNonWhitespaceId } from '../../../graphql/id';
import { formatIdentityStatus } from '../format-identity-status';
import { useUserIdentity } from '../IdentityProvider';

export function IdentityStrip() {
  const { userId, setIdentity } = useUserIdentity();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [showInvalid, setShowInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      return;
    }
    if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      actionRef.current?.focus();
    }
  }, [isEditing]);

  function beginIdentify() {
    setDraft('');
    setShowInvalid(false);
    setIsEditing(true);
  }

  function beginChange() {
    setDraft(userId ?? '');
    setShowInvalid(false);
    setIsEditing(true);
  }

  function onCancel() {
    setDraft('');
    setShowInvalid(false);
    restoreFocusRef.current = true;
    setIsEditing(false);
  }

  function onSave() {
    if (!isNonWhitespaceId(draft)) {
      setShowInvalid(true);
      return;
    }
    const ok = setIdentity(draft);
    if (!ok) {
      setShowInvalid(true);
      return;
    }
    setShowInvalid(false);
    restoreFocusRef.current = true;
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="mb-6 flex flex-wrap items-end gap-3" data-testid="identity-strip">
        <label className="flex flex-col gap-1 text-sm text-emerald-950" htmlFor="identity-email">
          Email
          <input
            ref={inputRef}
            className="rounded border border-emerald-200 px-2 py-1"
            data-testid="identity-email-input"
            id="identity-email"
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            value={draft}
          />
        </label>
        <button
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          data-testid="identity-save"
          disabled={!isNonWhitespaceId(draft)}
          onClick={onSave}
          type="button"
        >
          Save
        </button>
        <button
          className="rounded px-3 py-1.5 text-sm font-semibold text-emerald-800"
          data-testid="identity-cancel"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        {showInvalid ? (
          <p className="basis-full text-sm text-red-700" role="alert">
            Enter a non-empty ID.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3" data-testid="identity-strip">
      <p className="text-sm text-emerald-900" data-testid="identity-status">
        {formatIdentityStatus(userId)}
      </p>
      {userId === null ? (
        <button
          ref={actionRef}
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white"
          data-testid="identity-identify"
          onClick={beginIdentify}
          type="button"
        >
          Identify
        </button>
      ) : (
        <button
          ref={actionRef}
          className="rounded px-3 py-1.5 text-sm font-semibold text-emerald-800 underline"
          data-testid="identity-change"
          onClick={beginChange}
          type="button"
        >
          Change
        </button>
      )}
    </div>
  );
}
