import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useOnboardingProgress,
  useOnboardingSettings,
  useElapsedTracker,
  useOnboardingRequired,
} from "@/hooks/useOnboarding";
import { ONBOARDING_HTML } from "@/data/onboarding-content-html";
import {
  ONBOARDING_QUIZ,
  ONBOARDING_SECTIONS,
  REQUIRED_SECTIONS,
} from "@/data/onboarding-quiz";
import "@/styles/onboarding.css";
import { Button } from "@/components/ui/button";
import { LogOut, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";




export default function Onboarding() {
  const { profile, isAdmin, logout, user } = useAuth();
  const navigate = useNavigate();
  const { data: progress, markSectionViewed, markCompleted } = useOnboardingProgress();
  const { data: settings } = useOnboardingSettings();
  const required = useOnboardingRequired();

  const [current, setCurrent] = useState<string>("home");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizStartedAt] = useState<number>(() => Date.now());
  const [score, setScore] = useState(0);

  useElapsedTracker(true);

  const viewed = useMemo<string[]>(() => progress?.sections_viewed || [], [progress]);

  useEffect(() => {
    if (progress?.current_section) setCurrent(progress.current_section);
  }, [progress?.current_section]);

  // Carrega melhor tentativa de quiz já realizada, para que o usuário não precise refazer ao recarregar.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("onboarding_quiz_attempt")
        .select("score, total, passed")
        .eq("user_id", user.id)
        .eq("passed", true)
        .order("score", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setScore(data.score ?? 0);
      setQuizSubmitted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    markSectionViewed(current);
  }, [current, markSectionViewed]);

  const allSectionsViewed = REQUIRED_SECTIONS.every((s) => viewed.includes(s));
  const passingScore = settings?.passing_score ?? 5;
  const totalQuestions = ONBOARDING_QUIZ.length;
  const passed = quizSubmitted && score >= passingScore;
  const canFinish = allSectionsViewed && passed;
  const currentHtml = ONBOARDING_HTML[current] || "";

  const go = (id: string) => {
    setCurrent(id);
    window.scrollTo({ top: 0 });
  };

  const handleAnswer = (key: string, idx: number) => {
    if (quizSubmitted) return;
    setAnswers((p) => ({ ...p, [key]: idx }));
  };

  const submitQuiz = async () => {
    if (!user) return;
    let s = 0;
    for (const q of ONBOARDING_QUIZ) {
      if (answers[q.key] === q.correctIndex) s++;
    }
    const duration = Math.round((Date.now() - quizStartedAt) / 1000);
    const isPass = s >= passingScore;
    setScore(s);
    setQuizSubmitted(true);

    const { data: attempt } = await supabase
      .from("onboarding_quiz_attempt")
      .insert({
        user_id: user.id,
        submitted_at: new Date().toISOString(),
        score: s,
        total: totalQuestions,
        passed: isPass,
        duration_seconds: duration,
      })
      .select()
      .single();

    if (attempt) {
      const rows = ONBOARDING_QUIZ.map((q) => ({
        attempt_id: attempt.id,
        question_key: q.key,
        selected_index: answers[q.key] ?? -1,
        is_correct: answers[q.key] === q.correctIndex,
      }));
      await supabase.from("onboarding_quiz_answer").insert(rows);
    }

    if (isPass) {
      toast.success(`Você acertou ${s} de ${totalQuestions}!`);
    } else {
      toast.error(`Você acertou ${s} de ${totalQuestions}. Mínimo: ${passingScore}. Refaça o quiz.`);
    }
  };

  const retryQuiz = () => {
    setAnswers({});
    setQuizSubmitted(false);
    setScore(0);
  };

  const finish = async () => {
    await markCompleted(score, totalQuestions);
    toast.success("Onboarding concluído! Bem-vindo(a) ao Radar F8.");
    navigate("/meu-trabalho", { replace: true });
  };

  if (!required && progress?.completed_at && !isAdmin) {
    // já concluiu — permitir revisão mas mostrar botão de sair
  }

  return (
    <div className="onboarding-root min-h-screen bg-[var(--bg)]">
      {/* Topbar */}
      <div className="topbar">
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 1 }}>
          RADAR <span style={{ color: "var(--yellow-btn)" }}>F8</span> — Onboarding
        </div>
        <div className="topbar-right">
          <div className="prog-wrap">
            <span className="prog-label">Progresso:</span>
            <div className="dots">
              {ONBOARDING_SECTIONS.map((s) => (
                <span
                  key={s.id}
                  className={`dot ${viewed.includes(s.id) ? "done" : ""} ${
                    current === s.id ? "active" : ""
                  }`}
                  onClick={() => go(s.id)}
                  title={s.label}
                />
              ))}
            </div>
          </div>
          <span className="vtag">{profile?.name}</span>
          {(isAdmin || progress?.completed_at) && (
            <Button variant="outline" size="sm" onClick={() => navigate("/meu-trabalho")}>
              Sair do onboarding
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <span className="slabel">Conteúdo</span>
          {ONBOARDING_SECTIONS.map((s) => {
            const done = viewed.includes(s.id);
            return (
              <div
                key={s.id}
                className={`sitem ${current === s.id ? "active" : ""}`}
                onClick={() => go(s.id)}
              >
                <div className="snum">{s.num}</div>
                <span style={{ flex: 1 }}>{s.label}</span>
                {done && <CheckCircle2 className="h-4 w-4" style={{ color: "var(--green)" }} />}
              </div>
            );
          })}
        </aside>

        {/* Conteúdo */}
        <main style={{ marginLeft: "var(--sw)", flex: 1, padding: "40px 56px", maxWidth: 1100 }}>
          {current === "quiz" ? (
            <QuizSection
              answers={answers}
              onAnswer={handleAnswer}
              submitted={quizSubmitted}
              score={score}
              passingScore={passingScore}
              onSubmit={submitQuiz}
              onRetry={retryQuiz}
            />
          ) : (
            <div
              className="content"
              onClick={(e) => {
                const target = e.target as HTMLElement;

                const goEl = target.closest("[data-go]") as HTMLElement | null;
                if (goEl) {
                  e.preventDefault();
                  e.stopPropagation();
                  go(goEl.getAttribute("data-go") || "home");
                  return;
                }

                const scrollEl = target.closest("[data-scroll]") as HTMLElement | null;
                if (scrollEl) {
                  e.preventDefault();
                  e.stopPropagation();
                  const id = scrollEl.getAttribute("data-scroll") || "";
                  const el = document.getElementById(id);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }

                const a = target.closest("a[href]") as HTMLAnchorElement | null;
                if (!a) return;
                const href = a.getAttribute("href") || "";
                if (!href || href.startsWith("#")) return;
                e.preventDefault();
                e.stopPropagation();

                const ytMatch = href.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                if (ytMatch) {
                  const id = ytMatch[1];
                  const wrap = document.createElement("div");
                  wrap.className = "video-frame";
                  wrap.style.cssText = "position:relative;width:100%;max-width:720px;aspect-ratio:16/9;margin:16px 0;border-radius:12px;overflow:hidden;background:#000;";
                  wrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
                  a.replaceWith(wrap);
                  return;
                }

                window.open(href, "_blank", "noopener,noreferrer");
              }}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: currentHtml }}
            />


          )}

          {/* Navegação inferior */}
          <div
            className="bnav"
            style={{ marginTop: 40, display: "flex", justifyContent: "space-between", gap: 12 }}
          >
            <PrevNext current={current} onGo={go} />
          </div>

          {/* Conclusão */}
          {current === "sup" && (
            <div
              style={{
                marginTop: 40,
                padding: 24,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: 28, marginBottom: 12 }}>
                Concluir Onboarding
              </h3>
              <p style={{ marginBottom: 16 }}>
                Seções vistas: <strong>{viewed.filter((v) => REQUIRED_SECTIONS.includes(v)).length}</strong>/{REQUIRED_SECTIONS.length} ·
                Quiz: <strong>{quizSubmitted ? `${score}/${totalQuestions}` : "não realizado"}</strong>{" "}
                {passed && "✓"}
              </p>
              {!canFinish && (
                <p style={{ color: "var(--red)", marginBottom: 12 }}>
                  Para concluir é necessário ver todas as seções e atingir nota mínima de {passingScore}/{totalQuestions} no quiz.
                </p>
              )}
              <Button onClick={finish} disabled={!canFinish} size="lg">
                Concluir e acessar o sistema
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function PrevNext({ current, onGo }: { current: string; onGo: (id: string) => void }) {
  const idx = ONBOARDING_SECTIONS.findIndex((s) => s.id === current);
  const prev = idx > 0 ? ONBOARDING_SECTIONS[idx - 1] : null;
  const next = idx < ONBOARDING_SECTIONS.length - 1 ? ONBOARDING_SECTIONS[idx + 1] : null;
  return (
    <>
      {prev ? (
        <button className="btn btn-o" onClick={() => onGo(prev.id)}>
          ← {prev.label}
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button className="btn btn-p" onClick={() => onGo(next.id)}>
          {next.label} →
        </button>
      ) : (
        <span />
      )}
    </>
  );
}

function QuizSection({
  answers,
  onAnswer,
  submitted,
  score,
  passingScore,
  onSubmit,
  onRetry,
}: {
  answers: Record<string, number>;
  onAnswer: (k: string, i: number) => void;
  submitted: boolean;
  score: number;
  passingScore: number;
  onSubmit: () => void;
  onRetry: () => void;
}) {
  const allAnswered = ONBOARDING_QUIZ.every((q) => answers[q.key] !== undefined);
  return (
    <div className="content">
      <div className="step-header">
        <h2>
          QUIZ DE <span>FIXAÇÃO</span>
        </h2>
        <p>
          Responda as 7 perguntas. Você precisa acertar ao menos <strong>{passingScore}</strong> para
          liberar o sistema.
        </p>
      </div>

      <div className="quiz-wrap">
        {ONBOARDING_QUIZ.map((q, qi) => (
          <div className="qcard" key={q.key}>
            <div className="qnum">
              Pergunta {qi + 1} de {ONBOARDING_QUIZ.length}
            </div>
            <div className="qpergunta">{q.question}</div>
            <ul className="qopcoes">
              {q.options.map((opt, i) => {
                const selected = answers[q.key] === i;
                const correct = q.correctIndex === i;
                let style: React.CSSProperties = {};
                if (submitted) {
                  if (correct) style = { background: "var(--green-dim)", borderColor: "var(--green)" };
                  else if (selected) style = { background: "var(--red-dim)", borderColor: "var(--red)" };
                } else if (selected) {
                  style = { background: "var(--yellow-dim)", borderColor: "var(--yellow-btn)" };
                }
                return (
                  <li key={i} style={style} onClick={() => onAnswer(q.key, i)}>
                    {opt}
                  </li>
                );
              })}
            </ul>
            {submitted && (
              <div className="qfeedback" style={{ display: "block" }}>
                {answers[q.key] === q.correctIndex
                  ? "✓ Correto!"
                  : `✗ Resposta correta: ${q.options[q.correctIndex]}`}
              </div>
            )}
          </div>
        ))}
      </div>

      {submitted ? (
        <div className="quiz-resultado" style={{ display: "block" }}>
          <div className="qr-titulo">
            {score} / {ONBOARDING_QUIZ.length}
          </div>
          <div className="qr-texto">
            {score >= passingScore
              ? "Parabéns! Você está pronto para usar o Radar F8."
              : `Você precisa de pelo menos ${passingScore} acertos. Refaça o quiz.`}
          </div>
          <div className="quiz-btn-wrap">
            <button className="btn btn-p" onClick={onRetry}>
              Refazer o quiz
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button className="btn btn-p" disabled={!allAnswered} onClick={onSubmit}>
            Enviar respostas
          </button>
        </div>
      )}
    </div>
  );
}
