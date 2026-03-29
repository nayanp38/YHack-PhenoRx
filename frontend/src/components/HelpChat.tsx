import { Bot, Loader2, MessageCircleQuestion, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { askHelpChat } from '../lib/api'
import type { ActiveView } from '../types'

type ChatMessage = {
  role: 'assistant' | 'user'
  text: string
}

type Props = {
  page: ActiveView
}

const PAGE_LABELS: Record<ActiveView, string> = {
  intake: 'Patient Intake',
  enzyme: 'Enzyme Activity',
  risk: 'Risk Report',
  summary: 'Discharge Summary',
}

const DEFAULT_SUGGESTIONS: Record<ActiveView, string[]> = {
  intake: [
    'How do I get started on this page?',
    'What fields are required before I click Analyze Discharge?',
    'How does the demo patient button work?',
  ],
  enzyme: [
    'What is this page showing me?',
    'What is the difference between baseline and effective phenotype?',
    'What does delta mean here?',
  ],
  risk: [
    'How do I read the risk levels?',
    'Where do the alternatives come from?',
    'Why am I seeing insurance information here?',
  ],
  summary: [
    'What is this summary for?',
    'How is this different from the risk page?',
    'Can I regenerate this by changing the intake?',
  ],
}

function buildWelcome(page: ActiveView): ChatMessage {
  return {
    role: 'assistant',
    text: `I can help explain how to use the ${PAGE_LABELS[page]} screen and what to do next.`,
  }
}

export function HelpChat({ page }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcome(page)])
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS[page])

  useEffect(() => {
    setMessages([buildWelcome(page)])
    setSuggestions(DEFAULT_SUGGESTIONS[page])
    setInput('')
    setIsLoading(false)
  }, [page])

  const sendQuestion = async (question: string) => {
    const text = question.trim()
    if (!text || isLoading) return

    setMessages((current) => [...current, { role: 'user', text }])
    setInput('')
    setIsLoading(true)

    try {
      const reply = await askHelpChat(page, text)
      setMessages((current) => [...current, { role: 'assistant', text: reply.answer }])
      setSuggestions(reply.suggested_questions)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load help response'
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: `I couldn't load help right now. ${message}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="fixed bottom-5 right-5 z-[110] flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-[var(--px-bg)] shadow-lg transition hover:brightness-110"
        style={{
          background: 'linear-gradient(135deg, var(--px-accent), #10b981)',
          boxShadow: '0 0 24px rgba(52,211,153,0.25)',
        }}
      >
        {isOpen ? <X className="h-4 w-4" /> : <MessageCircleQuestion className="h-4 w-4" />}
        Help
      </button>

      {isOpen && (
        <aside
          className="fixed bottom-[5.5rem] right-5 z-[110] flex h-[560px] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            background: 'rgba(16,16,18,0.98)',
            borderColor: 'var(--px-border)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="flex items-start justify-between gap-4 border-b px-4 py-4 text-[var(--px-text)]"
            style={{ borderColor: 'var(--px-border)', background: 'rgba(255,255,255,0.03)' }}
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4 text-[var(--px-accent)]" />
                CYPher Help
              </div>
              <p className="mt-1 text-xs text-[var(--px-text-secondary)]">
                UI guidance for {PAGE_LABELS[page]}. Not medical advice.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-[var(--px-text-secondary)] transition hover:bg-white/10 hover:text-[var(--px-text)]"
              aria-label="Close help chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ background: 'var(--px-bg)' }}>
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  message.role === 'user'
                    ? 'ml-auto bg-[var(--px-accent)] text-[var(--px-bg)]'
                    : 'border border-[var(--px-border)] bg-[var(--px-bg-card)] text-[var(--px-text)]'
                }`}
              >
                {message.text}
              </div>
            ))}
            {isLoading && (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--px-border)] bg-[var(--px-bg-card)] px-4 py-3 text-sm text-[var(--px-text-secondary)] shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          <div
            className="border-t px-4 py-3"
            style={{ borderColor: 'var(--px-border)', background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestions.slice(0, 3).map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void sendQuestion(question)}
                  className="rounded-full border px-3 py-2 text-left text-xs font-medium transition hover:border-[var(--px-accent)] hover:text-[var(--px-accent)]"
                  style={{
                    borderColor: 'var(--px-border)',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--px-text)',
                  }}
                >
                  {question}
                </button>
              ))}
            </div>

            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void sendQuestion(input)
              }}
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                placeholder="Ask how to use this page"
                className="min-h-[52px] flex-1 resize-none rounded-2xl border px-3 py-3 text-sm text-[var(--px-text)] outline-none transition placeholder:text-[var(--px-text-tertiary)] focus:border-[var(--px-accent)]"
                style={{
                  borderColor: 'var(--px-border)',
                  background: 'rgba(255,255,255,0.04)',
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--px-bg)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'var(--px-accent)' }}
                aria-label="Send help question"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </aside>
      )}
    </>
  )
}
