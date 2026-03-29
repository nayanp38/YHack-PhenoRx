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
  enzyme: 'Enzyme Dashboard',
  risk: 'Risk Report',
  matrix: 'Drug Matrix',
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
  matrix: [
    'What does this matrix mean?',
    'What do the role labels mean?',
    'When should I use this page?',
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
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[var(--navy)] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[var(--accent-blue)]"
      >
        {isOpen ? <X className="h-4 w-4" /> : <MessageCircleQuestion className="h-4 w-4" />}
        Help
      </button>

      {isOpen && (
        <aside className="fixed bottom-22 right-5 z-50 flex h-[560px] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[var(--gray-200)] bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--gray-200)] bg-[var(--dark-navy)] px-4 py-4 text-white">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4" />
                PhenoRx Help
              </div>
              <p className="mt-1 text-xs text-white/80">
                UI guidance for {PAGE_LABELS[page]}. Not medical advice.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Close help chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--gray-50)] px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  message.role === 'user'
                    ? 'ml-auto bg-[var(--navy)] text-white'
                    : 'border border-[var(--gray-200)] bg-white text-[var(--gray-800)]'
                }`}
              >
                {message.text}
              </div>
            ))}
            {isLoading && (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--gray-200)] bg-white px-4 py-3 text-sm text-[var(--gray-500)] shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          <div className="border-t border-[var(--gray-200)] bg-white px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestions.slice(0, 3).map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void sendQuestion(question)}
                  className="rounded-full border border-[var(--gray-200)] bg-[var(--gray-50)] px-3 py-2 text-left text-xs font-medium text-[var(--gray-800)] transition hover:border-[var(--accent-blue)] hover:text-[var(--navy)]"
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
                className="min-h-[52px] flex-1 resize-none rounded-2xl border border-[var(--gray-200)] px-3 py-3 text-sm text-[var(--gray-800)] outline-none transition focus:border-[var(--accent-blue)]"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--navy)] text-white transition hover:bg-[var(--accent-blue)] disabled:cursor-not-allowed disabled:opacity-50"
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
