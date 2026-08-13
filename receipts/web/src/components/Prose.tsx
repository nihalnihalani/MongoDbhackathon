interface ProseProps {
  text: string
  className?: string
  /**
   * Render the opening sentence as an Instrument Serif italic lead-in
   * (DESIGN.md §8.2). Two lines of styling that make the agent's voice feel
   * authored rather than generated.
   */
  lead?: boolean
}

/** Splits "First sentence. Rest…" without breaking on ids like "PR #481." */
function splitLead(paragraph: string): [string, string] {
  const match = /^(.+?[.!?])(\s+)(.*)$/s.exec(paragraph)
  if (!match) return [paragraph, '']
  return [match[1]!, match[3]!]
}

/**
 * The agent's own writing, rendered verbatim. Blank-line-separated paragraphs at
 * a fixed prose measure — this is the thing a judge actually reads.
 */
export function Prose({ text, className = '', lead = false }: ProseProps) {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  const [leadSentence, leadRest] = lead && paragraphs[0] ? splitLead(paragraphs[0].trim()) : ['', '']

  return (
    <div className={`flex flex-col gap-4 ${className}`} style={{ maxWidth: 'var(--prose-max)' }}>
      {paragraphs.map((paragraph, i) => {
        const body = paragraph.trim()

        if (lead && i === 0) {
          return (
            <p
              key={i}
              style={{
                fontSize: 'var(--fs-prose)',
                lineHeight: 'var(--lh-prose)',
                color: 'var(--ink)',
              }}
            >
              <span
                className="display"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 'var(--fs-title)',
                  lineHeight: 1.35,
                }}
              >
                {leadSentence}
              </span>
              {leadRest && ' '}
              {leadRest}
            </p>
          )
        }

        return (
          <p
            key={i}
            style={{
              fontSize: 'var(--fs-prose)',
              lineHeight: 'var(--lh-prose)',
              color: 'var(--ink-2)',
            }}
          >
            {body}
          </p>
        )
      })}
    </div>
  )
}
