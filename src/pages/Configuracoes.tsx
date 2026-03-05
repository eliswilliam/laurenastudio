import { useState } from 'react';
import {
  Settings,
  User,
  Palette,
  Link2,
  Globe,
  Save,
  Camera,
  Plus,
  Trash2,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const contasSociais = [
  { id: '1', plataforma: 'Instagram', nome: '@laurena.studio', conectada: true, cor: '#E1306C' },
  { id: '2', plataforma: 'Facebook', nome: 'Laurena Studio Page', conectada: true, cor: '#1877F2' },
  { id: '3', plataforma: 'Twitter/X', nome: '@laurenastudio', conectada: true, cor: '#000000' },
  { id: '4', plataforma: 'LinkedIn', nome: 'Laurena Studio', conectada: false, cor: '#0A66C2' },
  { id: '5', plataforma: 'TikTok', nome: '', conectada: false, cor: '#000000' },
  { id: '6', plataforma: 'YouTube', nome: '', conectada: false, cor: '#FF0000' },
];

export default function Configuracoes() {
  const { toast } = useToast();

  const [perfil, setPerfil] = useState({
    nome: 'Maria Santos',
    email: 'maria@laurenastudio.com',
    cargo: 'Marketing Manager',
    bio: 'Gestora de marketing digital com foco em conteúdo e redes sociais.',
    telefone: '+55 11 99999-9999',
    idioma: 'pt-BR',
    fuso: 'America/Sao_Paulo',
  });

  const [branding, setBranding] = useState({
    corPrimaria: '#C15F3C',
    corSecundaria: '#B1ADA1',
    fonte: 'Inter',
    tomVoz: 'profissional',
    assinatura: 'Equipe Laurena Studio',
  });

  const [notificacoes, setNotificacoes] = useState({
    email: true,
    push: true,
    postPublicado: true,
    relatorioSemanal: true,
    erroPublicacao: true,
    novoComentario: false,
    limiteUso: true,
  });

  const handleSalvar = (secao: string) => {
    toast({
      title: 'Configurações salvas',
      description: `As configurações de ${secao} foram atualizadas com sucesso.`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Gerencie seu perfil, branding e integrações.
        </p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="perfil" className="gap-1.5 text-xs sm:text-sm">
            <User className="w-3.5 h-3.5" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-1.5 text-xs sm:text-sm">
            <Palette className="w-3.5 h-3.5" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="conexoes" className="gap-1.5 text-xs sm:text-sm">
            <Link2 className="w-3.5 h-3.5" />
            Conexões
          </TabsTrigger>
          <TabsTrigger value="contas" className="gap-1.5 text-xs sm:text-sm">
            <Globe className="w-3.5 h-3.5" />
            Redes
          </TabsTrigger>
        </TabsList>

        {/* Perfil */}
        <TabsContent value="perfil" className="space-y-6">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Informações Pessoais</CardTitle>
              <CardDescription>Atualize seus dados de perfil e preferências.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                  MS
                </div>
                <div>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    Alterar foto
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou GIF. Máx 5MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={perfil.nome}
                    onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={perfil.email}
                    onChange={(e) => setPerfil({ ...perfil, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input
                    value={perfil.cargo}
                    onChange={(e) => setPerfil({ ...perfil, cargo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={perfil.telefone}
                    onChange={(e) => setPerfil({ ...perfil, telefone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea
                  value={perfil.bio}
                  onChange={(e) => setPerfil({ ...perfil, bio: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <Select value={perfil.idioma} onValueChange={(v) => setPerfil({ ...perfil, idioma: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fuso horário</Label>
                  <Select value={perfil.fuso} onValueChange={(v) => setPerfil({ ...perfil, fuso: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                      <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                      <SelectItem value="America/Bahia">Bahia (GMT-3)</SelectItem>
                      <SelectItem value="America/Recife">Recife (GMT-3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSalvar('perfil')} className="gap-1.5">
                  <Save className="w-4 h-4" />
                  Salvar Perfil
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notificações */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Notificações</CardTitle>
              <CardDescription>Escolha como deseja receber alertas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Notificações por e-mail</p>
                  <p className="text-xs text-muted-foreground">Receba atualizações no seu e-mail</p>
                </div>
                <Switch
                  checked={notificacoes.email}
                  onCheckedChange={(v) => setNotificacoes({ ...notificacoes, email: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Notificações push</p>
                  <p className="text-xs text-muted-foreground">Alertas no navegador</p>
                </div>
                <Switch
                  checked={notificacoes.push}
                  onCheckedChange={(v) => setNotificacoes({ ...notificacoes, push: v })}
                />
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Tipos de notificação</p>
                {[
                  { key: 'postPublicado', label: 'Post publicado com sucesso' },
                  { key: 'relatorioSemanal', label: 'Relatório semanal de performance' },
                  { key: 'erroPublicacao', label: 'Erro na publicação' },
                  { key: 'novoComentario', label: 'Novo comentário nas postagens' },
                  { key: 'limiteUso', label: 'Alerta de limite de uso' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm">{item.label}</span>
                    <Switch
                      checked={notificacoes[item.key as keyof typeof notificacoes] as boolean}
                      onCheckedChange={(v) =>
                        setNotificacoes({ ...notificacoes, [item.key]: v })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => handleSalvar('notificações')} className="gap-1.5">
                  <Save className="w-4 h-4" />
                  Salvar Notificações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding */}
        <TabsContent value="branding" className="space-y-6">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Identidade Visual</CardTitle>
              <CardDescription>
                Personalize a aparência do conteúdo gerado pela IA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor primária</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.corPrimaria}
                      onChange={(e) => setBranding({ ...branding, corPrimaria: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                    <Input
                      value={branding.corPrimaria}
                      onChange={(e) => setBranding({ ...branding, corPrimaria: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor secundária</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.corSecundaria}
                      onChange={(e) => setBranding({ ...branding, corSecundaria: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                    <Input
                      value={branding.corSecundaria}
                      onChange={(e) => setBranding({ ...branding, corSecundaria: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fonte preferida</Label>
                <Select value={branding.fonte} onValueChange={(v) => setBranding({ ...branding, fonte: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="Poppins">Poppins</SelectItem>
                    <SelectItem value="Roboto">Roboto</SelectItem>
                    <SelectItem value="Montserrat">Montserrat</SelectItem>
                    <SelectItem value="Open Sans">Open Sans</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tom de voz padrão</Label>
                <Select value={branding.tomVoz} onValueChange={(v) => setBranding({ ...branding, tomVoz: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="inspirador">Inspirador</SelectItem>
                    <SelectItem value="humoristico">Humorístico</SelectItem>
                    <SelectItem value="educativo">Educativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assinatura de posts</Label>
                <Input
                  value={branding.assinatura}
                  onChange={(e) => setBranding({ ...branding, assinatura: e.target.value })}
                  placeholder="Texto de assinatura no rodapé dos posts"
                />
              </div>

              {/* Preview */}
              <div className="border rounded-xl p-4 space-y-3">
                <p className="text-xs text-muted-foreground font-medium">Preview da marca</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg"
                    style={{ backgroundColor: branding.corPrimaria }}
                  />
                  <div
                    className="w-10 h-10 rounded-lg"
                    style={{ backgroundColor: branding.corSecundaria }}
                  />
                  <span style={{ fontFamily: branding.fonte }} className="font-semibold">
                    {branding.fonte}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  Tom: {branding.tomVoz} · Assinatura: {branding.assinatura}
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSalvar('branding')} className="gap-1.5">
                  <Save className="w-4 h-4" />
                  Salvar Branding
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conexões API */}
        <TabsContent value="conexoes" className="space-y-6">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Chaves de API</CardTitle>
              <CardDescription>
                Gerencie suas chaves de API para integrações externas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Chave de Produção</p>
                    <p className="text-xs text-muted-foreground">Criada em 10/01/2026</p>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-200">Ativa</Badge>
                </div>
                <div className="flex gap-2">
                  <Input value="lrn_prod_••••••••••••••••••••mk4f" readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="sm">Copiar</Button>
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Chave de Desenvolvimento</p>
                    <p className="text-xs text-muted-foreground">Criada em 10/01/2026</p>
                  </div>
                  <Badge variant="outline" className="text-yellow-600 border-yellow-200">Teste</Badge>
                </div>
                <div className="flex gap-2">
                  <Input value="lrn_test_••••••••••••••••••••9x2a" readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="sm">Copiar</Button>
                </div>
              </div>
              <Button variant="outline" className="gap-1.5">
                <Plus className="w-4 h-4" />
                Gerar Nova Chave
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Webhooks</CardTitle>
              <CardDescription>
                Receba eventos em tempo real na sua aplicação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">Post publicado</p>
                  <Badge variant="outline" className="text-green-600 border-green-200">Ativo</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  https://api.meusite.com/webhooks/laurena
                </p>
                <div className="flex gap-2 mt-2">
                  <Button variant="ghost" size="sm" className="text-xs">Editar</Button>
                  <Button variant="ghost" size="sm" className="text-xs text-destructive">
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remover
                  </Button>
                </div>
              </div>
              <Button variant="outline" className="gap-1.5">
                <Plus className="w-4 h-4" />
                Adicionar Webhook
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contas Sociais */}
        <TabsContent value="contas" className="space-y-6">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Redes Sociais Conectadas</CardTitle>
              <CardDescription>
                Conecte e gerencie suas contas de redes sociais.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contasSociais.map((conta) => (
                <div key={conta.id} className="flex items-center justify-between border rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: conta.cor }}
                    >
                      {conta.plataforma[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{conta.plataforma}</p>
                      {conta.conectada ? (
                        <p className="text-xs text-muted-foreground">{conta.nome}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Não conectado</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {conta.conectada ? (
                      <>
                        <Badge variant="outline" className="text-green-600 border-green-200 gap-1">
                          <Check className="w-3 h-3" />
                          Conectado
                        </Badge>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive">
                          Desconectar
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" className="gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Conectar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
