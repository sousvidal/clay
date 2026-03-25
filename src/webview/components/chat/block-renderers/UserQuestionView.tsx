import { useState, useRef, useEffect } from 'react'
import { vscodeApi } from '../../../lib/vscode'
import type { UserQuestionBlock, UserQuestionItem } from '../../../lib/types'

interface SingleQuestionProps {
  q: UserQuestionItem
  selected: Set<string>
  showOther: boolean
  otherText: string
  onSelect: (label: string) => void
  onShowOther: (show: boolean) => void
  onOtherChange: (text: string) => void
  onOtherSubmit: () => void
  /** When true the parent handles submission; when false clicking a single-select option submits directly */
  deferSubmit: boolean
}

function SingleQuestion({
  q,
  selected,
  showOther,
  otherText,
  onSelect,
  onShowOther,
  onOtherChange,
  onOtherSubmit,
  deferSubmit,
}: SingleQuestionProps): React.JSX.Element {
  const otherInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showOther) otherInputRef.current?.focus()
  }, [showOther])

  return (
    <div className="space-y-1.5">
      <p className="font-medium text-foreground/90">{q.question}</p>

      {!showOther && (
        <div className="space-y-1.5">
          {q.options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => onSelect(opt.label)}
              className={
                q.multiSelect && selected.has(opt.label)
                  ? 'w-full rounded border border-blue-500/40 bg-blue-500/10 px-2.5 py-1.5 text-left text-[12px] text-foreground transition-colors'
                  : 'w-full rounded border border-border/30 px-2.5 py-1.5 text-left text-[12px] text-foreground/80 transition-colors hover:bg-muted/20'
              }
            >
              <span className="font-medium">{opt.label}</span>
              {opt.description && (
                <span className="ml-2 text-muted-foreground/60">{opt.description}</span>
              )}
            </button>
          ))}
          <button
            onClick={() => onShowOther(true)}
            className="w-full rounded border border-border/20 px-2.5 py-1.5 text-left text-[12px] text-muted-foreground/60 transition-colors hover:bg-muted/20"
          >
            Other…
          </button>
        </div>
      )}

      {q.multiSelect && !showOther && selected.size > 0 && !deferSubmit && (
        <button
          onClick={() => onOtherSubmit()}
          className="rounded bg-foreground/10 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-foreground/20"
        >
          Send
        </button>
      )}

      {showOther && (
        <div className="flex items-center gap-2">
          {q.options.length > 0 && (
            <button
              onClick={() => onShowOther(false)}
              className="shrink-0 text-[11px] text-muted-foreground/50 hover:text-muted-foreground"
            >
              ← Back
            </button>
          )}
          <input
            ref={otherInputRef}
            type="text"
            value={otherText}
            onChange={(e) => onOtherChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onOtherSubmit()
              }
            }}
            className="min-w-0 flex-1 rounded border border-input bg-background/60 px-2 py-1 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/50"
            placeholder="Your answer…"
          />
          {deferSubmit ? null : (
            <button
              onClick={onOtherSubmit}
              disabled={!otherText.trim()}
              className="rounded bg-foreground/10 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-foreground/20 disabled:opacity-40"
            >
              Send
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function UserQuestionView({
  block,
  onSubmit,
}: {
  block: UserQuestionBlock
  // If provided, called with the answers map instead of sending answerQuestion to the extension.
  onSubmit?: (answers: Record<string, string>) => void
}): React.JSX.Element | null {
  const { questions, toolCallId } = block
  const [answered, setAnswered] = useState(block.status === 'answered')
  const [selections, setSelections] = useState<Set<string>[]>(() =>
    questions.map(() => new Set<string>()),
  )
  const [showOthers, setShowOthers] = useState<boolean[]>(() => questions.map(() => false))
  const [otherTexts, setOtherTexts] = useState<string[]>(() => questions.map(() => ''))

  if (answered) return null

  const isSingleSingleSelect = questions.length === 1 && !questions[0].multiSelect

  function getAnswerFor(qi: number): string | null {
    if (showOthers[qi]) return otherTexts[qi].trim() || null
    const sel = selections[qi]
    return sel.size > 0 ? [...sel].join(', ') : null
  }

  function allAnswered(): boolean {
    return questions.every((_, i) => getAnswerFor(i) !== null)
  }

  function submitAll(overrideQi?: number, overrideAnswer?: string): void {
    const answers: Record<string, string> = {}
    for (let i = 0; i < questions.length; i++) {
      const ans = i === overrideQi ? overrideAnswer : getAnswerFor(i)
      if (ans) answers[questions[i].question] = ans
    }
    setAnswered(true)
    if (onSubmit) {
      onSubmit(answers)
    } else {
      const content =
        questions.length === 1 ? (Object.values(answers)[0] ?? '') : JSON.stringify(answers)
      vscodeApi.postMessage({ command: 'answerQuestion', toolUseId: toolCallId, answer: content })
    }
  }

  function handleSelect(qi: number, label: string): void {
    if (questions[qi].multiSelect) {
      setSelections((prev) => {
        const next = [...prev]
        const sel = new Set(next[qi])
        if (sel.has(label)) sel.delete(label)
        else sel.add(label)
        next[qi] = sel
        return next
      })
    } else {
      if (isSingleSingleSelect) {
        submitAll(qi, label)
      } else {
        setSelections((prev) => {
          const next = [...prev]
          next[qi] = new Set([label])
          return next
        })
      }
    }
  }

  function handleOtherSubmit(qi: number): void {
    const text = otherTexts[qi].trim()
    if (!text) return
    if (isSingleSingleSelect) {
      submitAll(qi, text)
    }
  }

  return (
    <div className="space-y-3 pl-1 text-[12px]">
      {questions.map((q, qi) => (
        <SingleQuestion
          key={qi}
          q={q}
          selected={selections[qi]}
          showOther={showOthers[qi]}
          otherText={otherTexts[qi]}
          onSelect={(label) => handleSelect(qi, label)}
          onShowOther={(show) => {
            setShowOthers((prev) => {
              const next = [...prev]
              next[qi] = show
              return next
            })
            if (show) {
              setSelections((prev) => {
                const next = [...prev]
                next[qi] = new Set()
                return next
              })
            }
          }}
          onOtherChange={(text) => {
            setOtherTexts((prev) => {
              const next = [...prev]
              next[qi] = text
              return next
            })
          }}
          onOtherSubmit={() => handleOtherSubmit(qi)}
          deferSubmit={!isSingleSingleSelect}
        />
      ))}

      {!isSingleSingleSelect && (
        <button
          onClick={() => submitAll()}
          disabled={!allAnswered()}
          className="rounded bg-foreground/10 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-foreground/20 disabled:opacity-40"
        >
          Submit
        </button>
      )}
    </div>
  )
}
