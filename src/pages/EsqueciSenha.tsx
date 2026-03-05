import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiForgotPassword } from '@/lib/authApi';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const { toast } = useToast();

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setCarregando(true);
    try {
      const data = await apiForgotPassword(email);
      setEnviado(true);
      toast({
        title: 'Token de reset gerado!',
        description: data.reset_token
          ? `Token (para teste): ${data.reset_token}`
          : 'Verifique sua caixa de entrada.',
      });
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <img src="/android-chrome-192x192.png" alt="Laurena Studio" className="w-8 h-8 rounded-lg" />
          <span className="font-bagel tracking-wider text-xl">LAURENA</span>
        </div>

        {!enviado ? (
          <>
            <h2 className="text-2xl font-bold mb-1">Esqueceu sua senha?</h2>
            <p className="text-muted-foreground mb-8">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </p>

            <form onSubmit={handleEnviar} className="space-y-4">
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
                  'Enviar link de recuperação'
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Verifique seu e-mail</h2>
            <p className="text-muted-foreground mb-6">
              Enviamos um link de recuperação para <span className="font-medium text-foreground">{email}</span>.
              Verifique sua caixa de entrada e siga as instruções.
            </p>
            <Button variant="outline" className="gap-2" onClick={() => setEnviado(false)}>
              Reenviar e-mail
            </Button>
          </div>
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
