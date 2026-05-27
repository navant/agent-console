import React, { useEffect, useState } from 'react';
import { TaskComment } from '../../types';
import { answerTaskQuestions } from '../../api/client';
import { emptyAnswersFor } from '../../utils/taskQuestions';

interface TaskQuestionsPanelProps {
  taskId: string;
  prdPath?: string;
  comment: TaskComment;
  isRunning: boolean;
  onAnswered: () => void;
  onContinueRun: () => void;
  continueLabel?: string;
}

export default function TaskQuestionsPanel({
  taskId,
  prdPath,
  comment,
  isRunning,
  onAnswered,
  onContinueRun,
  continueLabel = 'Submit & continue agent',
}: TaskQuestionsPanelProps) {
  const questions = comment.questions ?? [];
  const [open, setOpen] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(() =>
    emptyAnswersFor(questions)
  );
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAnswers(emptyAnswersFor(questions));
    setOtherText({});
    setOpen(true);
  }, [comment.id]);

  const setSingle = (qid: string, label: string) => {
    setAnswers(prev => ({ ...prev, [qid]: label }));
  };

  const toggleMulti = (qid: string, label: string) => {
    setAnswers(prev => {
      const cur = Array.isArray(prev[qid]) ? [...(prev[qid] as string[])] : [];
      const next = cur.includes(label) ? cur.filter(x => x !== label) : [...cur, label];
      return { ...prev, [qid]: next };
    });
  };

  const submit = async (andContinue: boolean) => {
    if (submitting) return;
    const payload: Record<string, string | string[]> = { ...answers };
    for (const q of questions) {
      const other = otherText[q.id]?.trim();
      if (!other) continue;
      const cur = payload[q.id];
      if (Array.isArray(cur)) {
        payload[q.id] = [...cur, `Other: ${other}`];
      } else if (typeof cur === 'string' && cur) {
        payload[q.id] = `${cur}\n\nOther: ${other}`;
      } else {
        payload[q.id] = other;
      }
    }

    setSubmitting(true);
    try {
      await answerTaskQuestions(taskId, comment.id, payload);
      onAnswered();
      if (andContinue) {
        onContinueRun();
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!questions.length) return null;

  return (
    <section className="task-detail-section task-questions-section">
      <button
        type="button"
        className="task-questions-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="task-questions-chevron">{open ? '▾' : '▸'}</span>
        <span className="task-detail-section-hd" style={{ margin: 0 }}>
          Questions &amp; answers
        </span>
        <span className="field-hint">{questions.length} pending</span>
      </button>

      {open && (
        <div className="task-questions-body">
          {prdPath && (
            <p className="field-hint">
              Answers are appended to linked PRD <span className="mono">{prdPath}</span> under{' '}
              <span className="mono">## User answers</span>.
            </p>
          )}

          {questions.map(q => (
            <div key={q.id} className="qcard">
              {q.header && <p className="qsub mono">{q.header}</p>}
              <p className="q">{q.question}</p>
              {q.options && q.options.length > 0 ? (
                <div className="qopts">
                  {q.options.map(opt => {
                    const selected = q.multiSelect
                      ? (answers[q.id] as string[] | undefined)?.includes(opt.label)
                      : answers[q.id] === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        className={'qopt' + (selected ? ' is-selected' : '')}
                        disabled={isRunning || submitting}
                        aria-pressed={selected}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() =>
                          q.multiSelect
                            ? toggleMulti(q.id, opt.label)
                            : setSingle(q.id, opt.label)
                        }
                      >
                        <span className="radio" aria-hidden />
                        <span className="qopt-text">
                          <strong>{opt.label}</strong>
                          {opt.description && (
                            <span className="field-hint qopt-desc">{opt.description}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  className="text"
                  rows={3}
                  placeholder="Your answer…"
                  value={typeof answers[q.id] === 'string' ? answers[q.id] : ''}
                  disabled={isRunning || submitting}
                  onChange={e => setSingle(q.id, e.target.value)}
                />
              )}
              <input
                className="text"
                style={{ marginTop: 8 }}
                placeholder="Other / notes (optional)"
                value={otherText[q.id] ?? ''}
                disabled={isRunning || submitting}
                onChange={e => setOtherText(prev => ({ ...prev, [q.id]: e.target.value }))}
              />
            </div>
          ))}

          <div className="task-questions-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isRunning || submitting}
              onClick={() => void submit(true)}
            >
              {submitting ? 'Submitting…' : continueLabel}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={isRunning || submitting}
              onClick={() => void submit(false)}
            >
              Submit only
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
