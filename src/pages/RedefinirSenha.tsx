import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiResetPassword } from '@/lib/authApi';

interface LocationState {
  email: string;
  code: string;
}

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const state = location.state as LocationState | null;

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // If the user arrived without valid state, redirect back to forgot password
  if (!state?.email || !state?.code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Link inválido. Solicite um novo código.</p>
          <Link to="/esqueci-senha">
            <Button variant="outline">Recuperar senha</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (novaSenha.length < 8) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 8 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast({
        title: 'Senhas diferentes',
        description: 'A confirmação de senha não coincide.',
        variant: 'destructive',
      });
      return;
    }

    setCarregando(true);
    try {
      await apiResetPassword(state.email, state.code, novaSenha);
      setSucesso(true);
    } catch (err: unknown) {
      toast({
        title: 'Erro ao redefinir senha',
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
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <img src="/android-chrome-192x192.png" alt="Laurena Studio" className="w-8 h-8 rounded-lg" />
          <span className="font-bagel tracking-wider text-xl">LAURENA</span>
        </div>

        {!sucesso ? (
          <>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-1">Nova senha</h2>
            <p className="text-muted-foreground mb-8">
              Crie uma nova senha segura para{' '}
              <span className="font-medium text-foreground">{state.email}</span>.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nova-senha">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="nova-senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-10 pr-10 h-11"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmar-senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="Repita a nova senha"
                    className="pl-10 h-11"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                {confirmarSenha && novaSenha !== confirmarSenha && (
                  <p className="text-xs text-destructive">As senhas não coincidem.</p>
                )}
              </div>

              {/* Password strength hint */}
              {novaSenha.length > 0 && novaSenha.length < 8 && (
                <p className="text-xs text-muted-foreground">
                  {8 - novaSenha.length} caractere{8 - novaSenha.length !== 1 ? 's' : ''} a mais necessário{8 - novaSenha.length !== 1 ? 's' : ''}.
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={carregando || novaSenha.length < 8 || novaSenha !== confirmarSenha}
              >
                {carregando ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </div>
                ) : (
                  'Redefinir senha'
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Senha atualizada!</h2>
              <p className="text-muted-foreground">
                Sua senha foi redefinida com sucesso. Faça login com sua nova senha.
              </p>
            </div>
            <Button className="w-full h-11" onClick={() => navigate('/login')}>
              Ir para o login
            </Button>
          </div>
        )}

        {!sucesso && (
          <div className="mt-8 text-center">
            <Link
              to="/esqueci-senha"
              className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
