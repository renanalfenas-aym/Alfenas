import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';
import { FOTO_GERENTE } from './fotoGerente.js';

// --- Renderizador simples de markdown (negrito, listas e tabelas) ---
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={keyPrefix + '-b-' + i}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={keyPrefix + '-t-' + i}>{part}</React.Fragment>;
  });
}

function MarkdownContent({ text }) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloco de tabela: linha com | e proxima linha e separador ---
    if (line.trim().startsWith('|') && lines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const headerCells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
      let r = i + 2;
      const rows = [];
      while (r < lines.length && lines[r].trim().startsWith('|')) {
        const cells = lines[r].split('|').map(c => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
        rows.push(cells);
        r++;
      }
      blocks.push(
        <div key={'tbl-' + key++} style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13.5px' }}>
            <thead>
              <tr>
                {headerCells.map((h, hi) => (
                  <th key={hi} style={{
                    textAlign: 'left', padding: '6px 10px',
                    background: '#EFE9DA', color: '#16233F',
                    borderBottom: '2px solid #C9974C', fontWeight: 600
                  }}>{renderInline(h, 'h' + hi)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? '#FFFFFF' : '#FAF8F2' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: '6px 10px', borderBottom: '1px solid #EEE9DD' }}>
                      {renderInline(cell, 'c' + ri + '-' + ci)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = r;
      continue;
    }

    // Lista com marcador
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      let r = i;
      while (r < lines.length && /^\s*[-*]\s+/.test(lines[r])) {
        items.push(lines[r].replace(/^\s*[-*]\s+/, ''));
        r++;
      }
      blocks.push(
        <ul key={'ul-' + key++} style={{ margin: '4px 0', paddingLeft: '20px' }}>
          {items.map((it, ii) => <li key={ii} style={{ marginBottom: '2px' }}>{renderInline(it, 'li' + ii)}</li>)}
        </ul>
      );
      i = r;
      continue;
    }

    // Linha em branco
    if (line.trim() === '') {
      blocks.push(<div key={'sp-' + key++} style={{ height: '6px' }} />);
      i++;
      continue;
    }

    // Paragrafo normal
    blocks.push(<div key={'p-' + key++} style={{ marginBottom: '2px' }}>{renderInline(line, 'p' + key)}</div>);
    i++;
  }

  return <>{blocks}</>;
}

export default function AYMChat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Fala! Pode perguntar sobre produto, calculo, ou pedir uma sugestao de resposta pro cliente, que eu te ajudo.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [savedPassword, setSavedPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('aym_password');
    if (stored) {
      setSavedPassword(stored);
      setUnlocked(true);
    }
    setCheckingAuth(false);
  }, []);

  const handleLogin = async () => {
    const pwd = passwordInput.trim();
    if (!pwd || loggingIn) return;
    setLoggingIn(true);
    setLoginError('');
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        localStorage.setItem('aym_password', pwd);
        setSavedPassword(pwd);
        setUnlocked(true);
      } else {
        setLoginError('Senha incorreta. Tenta de novo.');
      }
    } catch (err) {
      setLoginError('Deu um erro de conexao aqui. Tenta de novo em um instante.');
    } finally {
      setLoggingIn(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);

    recognitionRef.current = recognition;
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (recording) {
      recognitionRef.current.stop();
      setRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setRecording(true);
      } catch (e) {
        setRecording(false);
      }
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-password': savedPassword
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      if (response.status === 401) {
        localStorage.removeItem('aym_password');
        setSavedPassword('');
        setUnlocked(false);
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      const reply = data.reply || 'Nao consegui responder agora, tenta de novo.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Deu um erro de conexao aqui. Tenta de novo em um instante.' }]);
    } finally {
      setLoading(false);
    }
  };

  // Enter NUNCA envia (so quebra linha). O envio acontece exclusivamente pelo clique no botao.

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', background: '#F6F3ED' }} />;
  }

  if (!unlocked) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F6F3ED',
        fontFamily: "'Inter', -apple-system, sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px'
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{
            background: '#16233F',
            borderRadius: '14px',
            padding: '24px',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(22,35,63,0.18)'
          }}>
            <img
              src={FOTO_GERENTE}
              alt="Gerente"
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '10px',
                objectFit: 'cover',
                border: '2px solid #C9974C',
                marginBottom: '12px'
              }}
            />
            <div style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: '20px',
              fontWeight: 600,
              color: '#F6F3ED'
            }}>
              AYM &middot; Ask Your Manager
            </div>
            <div style={{ fontSize: '12.5px', color: '#C9974C', marginTop: '4px' }}>
              Acesso restrito &middot; Alfenas Consultoria
            </div>
          </div>

          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            marginTop: '16px',
            border: '1px solid #E7E1D5',
            padding: '20px'
          }}>
            <label style={{ fontSize: '13px', color: '#20242B', fontWeight: 500 }}>Senha de acesso</label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
              placeholder="Digite a senha do mes"
              style={{
                width: '100%',
                marginTop: '8px',
                border: '1px solid #E2DDD0',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '14.5px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {loginError && (
              <div style={{ fontSize: '12.5px', color: '#C0392B', marginTop: '8px' }}>{loginError}</div>
            )}
            <button
              onClick={handleLogin}
              disabled={loggingIn || !passwordInput.trim()}
              style={{
                width: '100%',
                marginTop: '14px',
                background: loggingIn || !passwordInput.trim() ? '#D9D2C2' : '#C9974C',
                border: 'none',
                borderRadius: '10px',
                padding: '11px',
                fontSize: '14.5px',
                fontWeight: 600,
                color: '#16233F',
                cursor: loggingIn || !passwordInput.trim() ? 'default' : 'pointer'
              }}
            >
              {loggingIn ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F6F3ED',
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px'
    }}>
      <div style={{ width: '100%', maxWidth: '760px' }}>

        <div style={{
          background: '#16233F',
          borderRadius: '14px',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 8px 24px rgba(22,35,63,0.18)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0, right: 0,
            width: '140px',
            height: '140px',
            background: 'radial-gradient(circle, rgba(201,151,76,0.25), transparent 70%)'
          }} />
          <img
            src={FOTO_GERENTE}
            alt="Gerente"
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '10px',
              objectFit: 'cover',
              flexShrink: 0,
              zIndex: 1,
              border: '2px solid #C9974C'
            }}
          />
          <div style={{ zIndex: 1 }}>
            <div style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: '20px',
              fontWeight: 600,
              color: '#F6F3ED',
              letterSpacing: '0.2px'
            }}>
              Gerente
            </div>
            <div style={{
              fontSize: '12.5px',
              color: '#C9974C',
              fontWeight: 500,
              marginTop: '2px',
              letterSpacing: '0.3px'
            }}>
              AYM &middot; Ask Your Manager
            </div>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          marginTop: '16px',
          border: '1px solid #E7E1D5',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '66vh'
        }}>
          <div ref={scrollRef} style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: m.role === 'user' ? '82%' : '94%',
                  padding: '11px 15px',
                  borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: m.role === 'user' ? '#16233F' : '#F1EDE3',
                  color: m.role === 'user' ? '#F6F3ED' : '#20242B',
                  fontSize: '14.5px',
                  lineHeight: '1.5'
                }}>
                  {m.role === 'assistant' ? <MarkdownContent text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '11px 15px',
                  borderRadius: '14px 14px 14px 2px',
                  background: '#F1EDE3',
                  color: '#8A8375',
                  fontSize: '14px'
                }}>
                  digitando...
                </div>
              </div>
            )}
          </div>

          <div style={{
            borderTop: '1px solid #EEE9DD',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            background: '#FBFAF6'
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <button
                onClick={toggleRecording}
                disabled={!micSupported}
                title={micSupported ? (recording ? 'Parar gravacao' : 'Gravar audio') : 'Microfone indisponivel neste ambiente'}
                style={{
                  background: recording ? '#C0392B' : '#EFE9DA',
                  border: 'none',
                  borderRadius: '10px',
                  width: '42px',
                  height: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: micSupported ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                  opacity: micSupported ? 1 : 0.4
                }}
              >
                {recording ? <MicOff size={18} color="#FFF" /> : <Mic size={18} color="#16233F" />}
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte algo, ou peca uma sugestao de resposta pro cliente..."
                rows={2}
                style={{
                  flex: 1,
                  resize: 'none',
                  border: '1px solid #E2DDD0',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '14.5px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: '#FFFFFF',
                  color: '#20242B'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                style={{
                  background: loading || !input.trim() ? '#D9D2C2' : '#C9974C',
                  border: 'none',
                  borderRadius: '10px',
                  width: '42px',
                  height: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: loading || !input.trim() ? 'default' : 'pointer',
                  flexShrink: 0
                }}
              >
                <Send size={18} color="#16233F" />
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#A8A090', paddingLeft: '2px' }}>
              Enter quebra linha. Envie clicando no botao ao lado.
            </div>
            {!micSupported && (
              <div style={{ fontSize: '11px', color: '#A8A090', paddingLeft: '2px' }}>
                Microfone nao suportado neste navegador/preview. Funciona em Chrome/Edge quando hospedado.
              </div>
            )}
            {recording && (
              <div style={{ fontSize: '11px', color: '#C0392B', paddingLeft: '2px' }}>
                Gravando... fale e depois toque no microfone de novo para parar.
              </div>
            )}
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          fontSize: '12px',
          color: '#A8A090',
          marginTop: '14px'
        }}>
          Uso interno &middot; Alfenas Consultoria &middot; conteudo exclusivo Embracon
        </div>
      </div>
    </div>
  );
}
