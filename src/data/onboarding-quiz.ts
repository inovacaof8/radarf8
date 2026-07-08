export interface QuizQuestion {
  key: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export const ONBOARDING_QUIZ: QuizQuestion[] = [
  {
    key: "q1",
    question: "O que você deve fazer se esquecer sua senha?",
    options: [
      "Criar uma nova conta com outro e-mail",
      'Clicar em "Esqueci minha senha" na tela de login',
      "Pedir para um colega emprestar o acesso dele",
      "Aguardar 24 horas e tentar novamente",
    ],
    correctIndex: 1,
  },
  {
    key: "q2",
    question: "Por que o sistema encerra sua sessão após 30 minutos sem uso?",
    options: [
      "Por causa de uma falha técnica",
      "Para economizar espaço no servidor",
      "É uma medida de segurança para proteger sua conta",
      "Porque o contrato de uso tem limite de horas",
    ],
    correctIndex: 2,
  },
  {
    key: "q3",
    question: "Qual tela mostra tudo que está atribuído a você, independente da data?",
    options: ["Dashboard", "Meu Dia", "Meu Trabalho", "Central de Notificações"],
    correctIndex: 2,
  },
  {
    key: "q4",
    question: "Você não encontra um módulo no menu lateral. O que provavelmente aconteceu?",
    options: [
      "O sistema está fora do ar",
      "O administrador não ativou aquele módulo para o seu perfil",
      "Você precisa atualizar o navegador",
      "Só aparece no celular",
    ],
    correctIndex: 1,
  },
  {
    key: "q5",
    question: "O que acontece se você não ler um comunicado dentro do prazo?",
    options: [
      "O comunicado é apagado automaticamente",
      "Sua conta é bloqueada",
      "O sistema envia lembretes automáticos para você",
      "Nada acontece, é opcional",
    ],
    correctIndex: 2,
  },
  {
    key: "q6",
    question: "O que é um plano de ação no Radar F8?",
    options: [
      "Um relatório mensal que o gestor preenche",
      "Um registro com responsável, prazo e descrição do que será feito, com evidências",
      "Uma lista de contatos da equipe",
      "Um comunicado enviado para toda a empresa",
    ],
    correctIndex: 1,
  },
  {
    key: "q7",
    question: "Você tem o direito de solicitar a exportação dos seus dados pessoais no Radar F8?",
    options: [
      "Não, só o administrador pode fazer isso",
      "Somente após 1 ano de uso",
      "Sim, a qualquer momento pelo seu próprio perfil",
      "Somente se a conta estiver encerrada",
    ],
    correctIndex: 2,
  },
];

export const ONBOARDING_SECTIONS = [
  { id: "home", num: "H", label: "Visão Geral" },
  { id: "s1", num: "1", label: "Primeiro Acesso" },
  { id: "s2", num: "2", label: "Navegando na plataforma" },
  { id: "s3", num: "3", label: "Projetos e Tarefas" },
  { id: "s4", num: "4", label: "Documentos" },
  { id: "s5", num: "5", label: "Comunicados" },
  { id: "s6", num: "6", label: "Privacidade dos seus dados" },
  { id: "s7", num: "7", label: "Métricas, indicadores e KPIs" },
  { id: "quiz", num: "Q", label: "Quiz de fixação" },
  
  { id: "sup", num: "S", label: "Suporte" },
];

export const REQUIRED_SECTIONS = ["home", "s1", "s2", "s3", "s4", "s5", "s6", "s7"];
