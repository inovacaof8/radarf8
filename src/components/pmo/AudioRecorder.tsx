import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  onTranscribed: (text: string) => void;
};

export default function AudioRecorder({ onTranscribed }: Props) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));
  }, []);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const appendLiveTranscript = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    liveTranscriptRef.current = `${liveTranscriptRef.current}${liveTranscriptRef.current ? "\n" : ""}${clean}`;
    setLiveTranscript(liveTranscriptRef.current);
  };

  const startLiveRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText) appendLiveTranscript(finalText);
      if (interimText)
        setLiveTranscript(`${liveTranscriptRef.current}${liveTranscriptRef.current ? "\n" : ""}${interimText.trim()}`);
    };
    recognition.onerror = () => undefined;
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }
  };

  const stopLiveRecognition = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore browser recognition stop errors
    }
    recognitionRef.current = null;
  };

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // result is like "data:audio/webm;base64,XXXX"
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  // Pick the best supported mime type for the recorder.
  const pickMimeType = (): string => {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
    }
    return "audio/webm";
  };
  const mimeRef = useRef<string>("audio/webm");

  const start = async () => {
    try {
      liveTranscriptRef.current = "";
      setLiveTranscript("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      mimeRef.current = mimeType;
      const mr = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = handleStop;
      mediaRecorderRef.current = mr;
      // Collect data every second for more reliable chunks on long recordings
      mr.start(1000);
      setRecording(true);
      startTimer();
      startLiveRecognition();
    } catch (e: any) {
      toast.error("Não foi possível acessar o microfone: " + (e?.message ?? e));
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    stopLiveRecognition();
    setRecording(false);
    stopTimer();
  };

  const handleStop = async () => {
    setTranscribing(true);
    try {
      const mt = mimeRef.current || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mt });
      if (blob.size < 1000) {
        toast.error("Áudio muito curto.");
        return;
      }
      const base64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: { audio_base64: base64, mime_type: mt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const text = (data?.text ?? "").trim();
      const fallbackText = liveTranscriptRef.current.trim();
      const bestText = text.length >= Math.max(20, fallbackText.length * 0.8) ? text : fallbackText;
      if (!bestText) {
        toast.error(
          "A transcrição veio vazia. Tente novamente e confirme se o navegador está usando o microfone correto.",
        );
        return;
      }
      onTranscribed(bestText);
      toast.success(text ? "Áudio transcrito." : "Texto carregado pela captura ao vivo.");
    } catch (e: any) {
      const fallbackText = liveTranscriptRef.current.trim();
      if (fallbackText) {
        onTranscribed(fallbackText);
        toast.warning("A IA não retornou texto, então carreguei a captura ao vivo do navegador.");
        return;
      }
      toast.error(e.message ?? "Erro ao transcrever áudio");
    } finally {
      setTranscribing(false);
    }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-3">
      {!recording ? (
        <Button type="button" variant="outline" disabled>
          {transcribing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Transcrevendo…
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" /> Gravar áudio (Em breve)
            </>
          )}
        </Button>
      ) : (
        <>
          <Button type="button" variant="destructive" onClick={stop}>
            <Square className="mr-2 h-4 w-4" /> Parar ({fmt(elapsed)})
          </Button>
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" /> Gravando…
          </span>
        </>
      )}
      {!speechSupported && !recording && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> Use Chrome ou Edge para fallback ao vivo.
        </span>
      )}
      {recording && liveTranscript && (
        <span className="text-xs text-muted-foreground max-w-[360px] truncate">{liveTranscript}</span>
      )}
    </div>
  );
}
