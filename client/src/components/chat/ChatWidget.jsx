import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Aperture, ArrowUp, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { streamChatMessage, getChatHealth } from "@/services/chatService";

/**
 * ChatWidget — floating AI assistant, wired to the real streaming
 * endpoint at POST /api/chat (server/src/controllers/chat.controller.js).
 *
 * Sits outside <Routes> in App.jsx so it persists across every page
 * rather than resetting on navigation.
 *
 * Design intent: same paper/darkroom language as the rest of the
 * site — the panel reads like a printed contact sheet rather than a
 * generic SaaS chat bubble. User turns align right in solid ink;
 * assistant turns align left on paper-dim, no bubble outlines, just
 * quiet color blocks separated by breathing room.
 */

const STORAGE_DISMISS_KEY = "lucent-chat-intro-seen";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(true); // optimistic until health check resolves
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi — I'm the studio assistant. Ask me about packages, pricing, camera rentals, or availability.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [needsEscalation, setNeedsEscalation] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // health check once on first mount — disables the widget gracefully
  // if ANTHROPIC_API_KEY isn't configured server-side, instead of
  // letting every message attempt fail silently
  useEffect(() => {
    let cancelled = false;
    getChatHealth()
      .then((res) => {
        if (!cancelled) setAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => { cancelled = true; };
  }, []);

  // autoscroll to newest message
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [open]);

  // cancel any in-flight stream if the widget unmounts
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    setError("");
    setInput("");
    setNeedsEscalation(false);

    const history = messages
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMessage = { role: "user", content: trimmed };
    const assistantDraft = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMessage, assistantDraft]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { needsEscalation: escalate } = await streamChatMessage(
        { message: trimmed, history },
        (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: next[next.length - 1].content + delta,
            };
            return next;
          });
        },
        controller.signal
      );
      setNeedsEscalation(escalate);
      if (!open) setHasUnread(true);
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Something went wrong. Please try again.");
      setMessages((prev) => prev.slice(0, -1)); // drop the empty assistant draft
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!available) return null; // no point showing a widget that can't respond

  return (
    <>
      {/* floating launcher */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        aria-label={open ? "Close assistant" : "Open studio assistant"}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-ink text-paper shadow-lg flex items-center justify-center hover:bg-signature transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "close" : "open"}
            initial={{ opacity: 0, rotate: -45 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 45 }}
            transition={{ duration: 0.2 }}
          >
            {open ? <X className="h-5 w-5" strokeWidth={1.5} /> : <MessageCircle className="h-5 w-5" strokeWidth={1.5} />}
          </motion.span>
        </AnimatePresence>
        {hasUnread && !open && (
          <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-signature ring-2 ring-paper" />
        )}
      </motion.button>

      {/* panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="Studio assistant chat"
            className="fixed bottom-24 right-6 z-40 w-[calc(100vw-3rem)] max-w-[380px] h-[520px] max-h-[70vh] bg-paper border border-line shadow-2xl flex flex-col"
          >
            {/* header */}
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-line">
              <Aperture className="h-4 w-4 text-ink" strokeWidth={1.5} />
              <div>
                <p className="font-display text-[15px] text-ink leading-tight">Studio Assistant</p>
                <p className="meta-caption !text-mist-light">Usually replies instantly</p>
              </div>
            </div>

            {/* messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn("max-w-[85%] text-[13.5px] leading-relaxed", m.role === "user" ? "self-end" : "self-start")}
                >
                  <div
                    className={cn(
                      "px-3.5 py-2.5",
                      m.role === "user" ? "bg-ink text-paper" : "bg-paper-dim text-ink"
                    )}
                  >
                    {m.content || (
                      <span className="inline-flex gap-1">
                        <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {needsEscalation && (
                <div className="self-start max-w-[85%] border border-line px-3.5 py-3 text-[12.5px] text-mist leading-relaxed">
                  Want to talk to a person instead?{" "}
                  <a href="mailto:hello@lucentstudio.com" className="text-signature underline underline-offset-2">
                    Email the studio
                  </a>{" "}
                  and we'll pick it up from here.
                </div>
              )}

              {error && (
                <p className="self-start text-[12.5px] font-mono text-red-500/90">{error}</p>
              )}
            </div>

            {/* input */}
            <div className="border-t border-line p-3 flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about packages, pricing, rentals…"
                rows={1}
                maxLength={1000}
                disabled={streaming}
                className="flex-1 resize-none bg-transparent text-[13.5px] text-ink placeholder:text-mist-light focus:outline-none py-2 px-1 max-h-24"
              />
              <button
                type="button"
                onClick={send}
                disabled={streaming || !input.trim()}
                aria-label="Send message"
                className="h-9 w-9 flex items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30 disabled:cursor-not-allowed hover:bg-signature transition-colors duration-200 shrink-0"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Dot({ delay = 0 }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-mist-light inline-block"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}
