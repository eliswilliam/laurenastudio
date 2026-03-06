import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiForgotPassword, apiVerifyResetCode } from '@/lib/authApi';

type Step = 'email' | 'code';

export default function EsqueciSenha() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [carregando, setCarregando] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Step 1: send email ────────────────────────────────────────────────────
  const handleEnviarEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setCarregando(true);
    try {
      await apiForgotPassword(email);
      setStep('code');
      toast({ title: 'Código enviado!', description: 'Verifique sua caixa de entrada.' });
    } catch (err: unknown) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  // ── Step 2: verify code ───────────────────────────────────────────────────
  const codeString = code.join('');

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerificarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codeString.length !== 6) return;
    setCarregando(true);
    try {
      await apiVerifyResetCode(email, codeString);
      // Navigate to new-password page, passing email + code via router state
      navigate('/redefinir-senha', { state: { email, code: codeString } });
    } catch (err: unknown) {
      toast({
        title: 'Código inválido',
        description: err instanceof Error ? err.message : 'Verifique o código e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  const handleReenviar = async () => {
    setCarregando(true);
    try {
      await apiForgotPassword(email);
      setCode(['', '', '', '', '', '']);
      toast({ title: 'Novo código enviado!', description: 'Verifique sua caixa de entrada.' });
    } catch {
      toast({ title: 'Erro ao reenviar', variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <img src="/android-chrome-192x192.png" alt="Laurena Studio" className="w-8 h-8 rounded-lg" />
          <span className="font-bagel tracking-wider text-xl">LAURENA</span>
        </div>

        {/* ── Step 1: Email ── */}
        {step === 'email' && (
          <>
            <h2 className="text-2xl font-bold mb-1">Esqueceu sua senha?</h2>
            <p className="text-muted-foreground mb-8">
              Informe seu e-mail e enviaremos um código de 6 dígitos para recuperar sua senha.
            </p>

            <form onSubmit={handleEnviarEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-10 h-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11" disabled={carregando}>
                {carregando ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando...
                  </div>
                ) : (
                  'Enviar código de recuperação'
                )}
              </Button>
            </form>
          </>
        )}

        {/* ── Step 2: 6-digit code ── */}
        {step === 'code' && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-1 text-center">Verifique seu e-mail</h2>
            <p className="text-muted-foreground mb-8 text-center">
              Enviamos um código de 6 dígitos para{' '}
              <span className="font-medium text-foreground">{email}</span>.
            </p>

            <form onSubmit={handleVerificarCodigo} className="space-y-6">
              {/* 6-digit inputs */}
              <div className="flex justify-center gap-3" onPaste={handleCodePaste}>
                {code.map((digit, i) => (
                  <Input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold"
                  />
                ))}
              </div>

              <Button
                type="submit"
                className="w-full h-11"
                disabled={carregando || codeString.length !== 6}
              >
                {carregando ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verificando...
                  </div>
                ) : (
                  'Verificar código'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleReenviar}
                disabled={carregando}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Não recebeu? Reenviar código
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(['', '', '', '', '', '']); }}
                className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Alterar e-mail
              </button>
            </div>
          </>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
