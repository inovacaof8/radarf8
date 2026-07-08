export const ONBOARDING_HTML: Record<string,string> = {
  'home': `<div class="hero">
    <canvas class="hero-canvas" id="heroCanvas"></canvas>
    <div class="hero-tag">Guia de boas-vindas</div>
    <h1>BEM-VINDO AO<br><span>RADAR F8</span></h1>
    <p class="hero-sub">Este guia mostra tudo que você precisa saber para começar a usar o sistema com segurança e autonomia.</p>
    <div class="hero-actions">
      <button class="btn btn-p" data-scroll="oque-radar">Começar agora</button>
    </div>
  </div>
  <div class="content">
    <div class="pb">
      <span class="pbl">Progresso do onboarding</span>
      <div class="pbt"><div class="pbf" id="compFill"></div></div>
      <span class="pbp" id="compPct">0%</span>
    </div>

    <span class="slbl" id="oque-radar">O que é o Radar F8</span>
    <div class="card">
      <div class="card-title">Um sistema para organizar o trabalho da sua equipe</div>
      <p>O Radar F8 reúne em um só lugar tudo que sua equipe precisa: projetos, tarefas, documentos, planos de ação, reuniões e comunicados. Você acessa tudo pelo navegador, com login e senha, de qualquer dispositivo.</p>
    </div>

    <span class="slbl" style="margin-top:28px">O que você pode fazer aqui</span>
    <div class="g3">
      <div class="mcard" data-go="s3">
        <div class="micon">PRJ</div>
        <div class="mname">Projetos e tarefas</div>
        <div class="mdesc">Acompanhe o andamento de projetos, veja seus prazos e o que está atribuído a você.</div>
        <span class="mtag">Seção 3</span>
      </div>
      <div class="mcard" data-go="s4">
        <div class="micon">DOC</div>
        <div class="mname">Documentos</div>
        <div class="mdesc">Acesse, envie e gerencie documentos com controle de versão e aprovação.</div>
        <span class="mtag">Seção 4</span>
      </div>
      <div class="mcard" data-go="s5">
        <div class="micon">COM</div>
        <div class="mname">Comunicados</div>
        <div class="mdesc">Receba avisos e comunicados oficiais da sua organização com rastreio de leitura.</div>
        <span class="mtag">Seção 5</span>
      </div>
      <div class="mcard" data-go="s3">
        <div class="micon">ACO</div>
        <div class="mname">Planos de ação</div>
        <div class="mdesc">Crie e acompanhe planos com responsáveis, prazos e evidências de atividades.</div>
        <span class="mtag">Seção 3</span>
      </div>
      <div class="mcard" data-go="s3">
        <div class="micon">REU</div>
        <div class="mname">Reuniões</div>
        <div class="mdesc">Agende reuniões, registre atas e acompanhe os itens de ação combinados.</div>
        <span class="mtag">Seção 3</span>
      </div>
      <div class="mcard" data-go="s2">
        <div class="micon">DIA</div>
        <div class="mname">Meu Dia</div>
        <div class="mdesc">Veja tudo que é sua responsabilidade para o dia, agrupado por origem.</div>
        <span class="mtag">Seção 2</span>
      </div>
    </div>

    <div class="hb">
      <div class="hbt">Por onde começar</div>
      <p>Se é seu primeiro acesso, vá para a seção <strong>Primeiro Acesso</strong> e siga o passo a passo. O processo leva menos de 10 minutos.</p>
    </div>

    
  </div>`,
  's1': `<div class="content">
    <div class="step-header">
      <h2>PRIMEIRO <span>ACESSO</span></h2>
      <p>Siga estes passos e você estará usando o sistema em menos de 10 minutos. Cada etapa é obrigatória e acontece apenas uma vez.</p>
    </div>

    <div class="timeline">
      <div class="tli">
        <div class="tll"><div class="tln">1</div><div class="tlln"></div></div>
        <div class="tlb">
          <div class="tlt">Verifique seu e-mail</div>
          <div class="tld">O administrador do sistema cadastrou você e o sistema enviou um e-mail automático. Esse e-mail contém uma senha temporária ou um link direto para você definir sua própria senha. Se não encontrar na caixa de entrada, verifique a pasta de spam ou lixo eletrônico — e-mails automáticos costumam cair lá.</div>
          <div class="tlp">Se o e-mail não chegar em até 15 minutos, entre em contato com o administrador do sistema na sua organização para que ele reenvie o convite.</div>
        </div>
      </div>
      <div class="tli">
        <div class="tll"><div class="tln">2</div><div class="tlln"></div></div>
        <div class="tlb">
          <div class="tlt">Acesse a tela de login</div>
          <div class="tld">Abra o endereço do Radar F8 no seu navegador e informe seu e-mail corporativo e a senha que você recebeu. O sistema também oferece a opção de entrar com sua conta Google — mas só funciona se o administrador já tiver cadastrado seu perfil com esse mesmo e-mail do Google. Se a opção Google não aparecer ou não funcionar, use e-mail e senha normalmente.</div>
        </div>
      </div>
      <div class="tli">
        <div class="tll"><div class="tln">3</div><div class="tlln"></div></div>
        <div class="tlb">
          <div class="tlt">Leia e aceite os documentos legais</div>
          <div class="tld">Antes de continuar, o sistema exibe três documentos que você precisa aceitar: a Política de Privacidade (explica quais dados são coletados e como são usados), os Termos de Uso (descreve as regras de utilização da plataforma) e a Política de Cookies (informa sobre o uso de arquivos de rastreamento no navegador). Esse aceite é exigido pela Lei Geral de Proteção de Dados e fica registrado com data e hora. Você só precisa aceitar uma vez — nas próximas entradas o sistema vai direto para o sistema.</div>
          <div class="tlp">Se os documentos forem atualizados pela organização, o sistema pedirá um novo aceite na próxima vez que você acessar.</div>
        </div>
      </div>
      <div class="tli">
        <div class="tll"><div class="tln">4</div><div class="tlln"></div></div>
        <div class="tlb">
          <div class="tlt">Troque a senha temporária</div>
          <div class="tld">A senha que você recebeu por e-mail é temporária e expira. O sistema vai pedir que você crie uma senha definitiva agora mesmo. Escolha uma senha que você não use em outros sistemas ou sites. Uma boa senha tem pelo menos 8 caracteres e mistura letras maiúsculas, minúsculas, números e algum símbolo como ponto ou arroba. Evite datas de aniversário, nomes de pessoas ou sequências óbvias como 123456.</div>
          <div class="tlp">Guarde sua senha em local seguro. O sistema não tem acesso a ela e não consegue revelá-la para ninguém — só é possível redefinir.</div>
        </div>
      </div>
      <div class="tli">
        <div class="tll"><div class="tln">5</div></div>
        <div class="tlb">
          <div class="tlt">Complete seu perfil</div>
          <div class="tld">Depois de entrar, vá em Meu Perfil no menu lateral. Preencha sua foto (ajuda colegas a identificar quem fez cada ação no sistema), telefone de contato e, principalmente, informe a qual área da empresa você pertence. A área é o que determina quais projetos, planos de ação e documentos aparecem para você. Se você pertence a mais de uma área, o administrador pode configurar isso também.</div>
          <div class="tlp">Um perfil incompleto pode fazer com que tarefas e comunicados direcionados à sua área não cheguem até você.</div>
        </div>
      </div>
    </div>

    <div class="divider"></div>
    <span class="slbl">Sobre o login com Google</span>
    <div class="card">
      <div class="card-title">Como funciona o acesso com conta Google</div>
      <p>O Radar F8 permite que você entre usando sua conta Google corporativa em vez de digitar e-mail e senha toda vez. Para isso funcionar, duas condições precisam ser atendidas: seu administrador precisa ter habilitado essa opção no sistema, e o e-mail da sua conta Google precisa ser exatamente o mesmo e-mail com que você foi cadastrado no Radar F8. Se qualquer uma dessas condições não for atendida, o botão Google vai aparecer mas não vai funcionar — use e-mail e senha normalmente e informe o administrador para verificar.</p>
    </div>

    <div class="hb warn">
      <div class="hbt">Situações que podem travar seu acesso</div>
      <ul>
        <li><strong>Conta bloqueada:</strong> se você errar a senha várias vezes seguidas, o sistema bloqueia temporariamente a conta como medida de segurança. Contate o administrador para desbloquear.</li>
        <li><strong>Sessão encerrada:</strong> se você ficar 30 minutos sem interagir com o sistema, ele encerra a sessão automaticamente. Basta fazer login novamente — você não perde nenhum dado salvo.</li>
        <li><strong>Senha esquecida:</strong> clique em "Esqueci minha senha" na tela de login. O sistema envia um link de redefinição para o seu e-mail. O link expira em algumas horas, então use logo após receber.</li>
        <li><strong>E-mail de convite não chegou:</strong> verifique spam. Se não estiver lá, peça ao administrador para reenviar ou verificar se o e-mail cadastrado está correto.</li>
      </ul>
    </div>

    <div class="divider"></div>
    <span class="slbl">Vídeo de apoio — em português</span>

    <a class="vc" href="https://www.youtube.com/watch?v=nW3hL5jTvjg" target="_blank" rel="noopener">
      <div class="vci">
        <div class="vthumb" style="width:210px;"><div class="play"><div class="arr"></div></div></div>
        <div class="vinfo">
          <div class="vlbl">Segurança digital</div>
          <div class="vtitle">Como criar senhas seguras para proteger suas contas</div>
          <div class="vdesc">Dicas práticas para criar senhas fortes, o que evitar e como proteger sua conta no dia a dia. Em português.</div>
          <span class="vcta">Assistir no YouTube</span>
        </div>
      </div>
    </a>

    
  </div>`,
  's2': `<div class="content">
    <div class="step-header">
      <h2>NAVEGANDO NA <span>PLATAFORMA</span></h2>
      <p>O Radar F8 tem uma estrutura de navegação consistente em todas as telas. Entender cada elemento evita confusão e torna o uso muito mais fluido.</p>
    </div>

    <span class="slbl">Elementos fixos de navegação</span>
    <div class="g2">
      <div class="card">
        <div class="card-title">Menu lateral (sidebar)</div>
        <p>A coluna do lado esquerdo lista todos os módulos que o seu perfil tem permissão de acessar. Clique em qualquer item para abrir aquela área. O menu não é o mesmo para todo mundo — o administrador define quais módulos cada usuário pode ver. Se um módulo que você precisa não aparecer, solicite ao administrador que ajuste sua permissão. O menu permanece fixo enquanto você navega pelo conteúdo, para que você possa trocar de área a qualquer momento.</p>
      </div>
      <div class="card">
        <div class="card-title">Barra superior</div>
        <p>A faixa no topo da tela exibe o logo do sistema, o sino de notificações e o acesso ao seu perfil. Ela aparece em todas as páginas e é sempre o caminho mais rápido para verificar avisos recentes ou ajustar seus dados pessoais. Em telas menores, o menu lateral pode se transformar em um botão no canto da barra superior — basta clicar para abri-lo.</p>
      </div>
      <div class="card">
        <div class="card-title">Sino de notificações</div>
        <p>O ícone de sino na barra superior mostra quantos comunicados ou alertas você ainda não leu. Clique nele para ver a lista completa. Os itens mais recentes aparecem primeiro. Comunicados que exigem aceite ficam destacados até que você confirme a leitura. Depois de ler tudo, o contador some. O sino não substitui a tela de Comunicados — ele é só um atalho rápido para os itens mais urgentes.</p>
      </div>
      <div class="card">
        <div class="card-title">Botão de ação rápida</div>
        <p>O botão redondo que fica fixo no canto inferior direito da tela permite criar uma nova tarefa sem sair de onde você está. É muito útil durante reuniões — surgiu algo para fazer? Clique no botão, registre a tarefa com título, prazo e responsável, e continue a reunião. A tarefa já fica vinculada a você e aparece no Meu Dia na data combinada.</p>
      </div>
    </div>

    <span class="slbl" style="margin-top:8px">Suas telas pessoais</span>
    <div class="g3">
      <div class="card">
        <div class="card-title">Meu Dia</div>
        <p>Reúne tudo que vence hoje ou está pendente e atribuído a você, agrupado por origem: tarefas de projetos, itens de planos de ação, reuniões do dia e ações combinadas em reuniões anteriores. É o ponto de partida ideal para começar o expediente. O que não for concluído hoje fica marcado como atrasado e aparece novamente no dia seguinte com destaque.</p>
      </div>
      <div class="card">
        <div class="card-title">Meu Trabalho</div>
        <p>Diferente do Meu Dia, que filtra por data, o Meu Trabalho mostra tudo que está atribuído a você sem filtro de prazo. Use essa tela quando quiser ter uma visão completa da sua carga de trabalho — o que vence essa semana, o que ainda está em aberto de semanas anteriores, e o que foi concluído. É útil também para planejar a semana antes de começar.</p>
      </div>
      <div class="card">
        <div class="card-title">Notas pessoais</div>
        <p>Um bloco de anotações particular, acessível pelo menu. O que você escreve aqui só você vê — não é compartilhado com a equipe nem aparece em relatórios. Use para rascunhar ideias, guardar lembretes rápidos ou registrar observações durante reuniões antes de transformá-las em tarefas formais no sistema.</p>
      </div>
    </div>

    <span class="slbl" style="margin-top:8px">Perfil e configurações pessoais</span>
    <div class="card">
      <div class="card-title">Meu Perfil — o que você pode configurar</div>
      <p>Acesse seu perfil clicando no seu nome ou foto na barra superior. Lá você pode atualizar sua foto (aparece em todos os registros do sistema onde seu nome aparece), seu telefone de contato, sua senha e a área da organização à qual você pertence. A área é especialmente importante: ela define quais projetos, planos de ação e documentos ficam visíveis para você. Se você perceber que está vendo conteúdo que não é da sua área ou deixando de ver o que deveria, avise o administrador para corrigir seu vínculo de área. Também é no perfil que você encontra o botão para exportar seus dados pessoais, conforme garante a lei.</p>
    </div>

    <div class="hb">
      <div class="hbt">O que fazer quando algo não aparece no menu</div>
      <p>Se um módulo que você precisa não está no seu menu lateral, há três possibilidades: o administrador não ativou aquele módulo para a organização inteira; o módulo existe mas não foi liberado para o seu perfil; ou você está vendo uma versão desatualizada da tela — tente recarregar a página. Em qualquer caso, a solução é falar com o administrador do sistema. Não tente acessar um módulo diretamente pela URL — o sistema valida as permissões e vai bloquear o acesso de qualquer forma.</p>
    </div>

    
  </div>`,
  's3': `<div class="content">
    <div class="step-header">
      <h2>PROJETOS, REUNIÕES<br><span>E PLANOS DE AÇÃO</span></h2>
      <p>Este é o coração operacional do Radar F8. Aqui ficam os projetos da sua organização, as reuniões com suas atas e os planos de ação que garantem que as decisões se transformem em resultado.</p>
    </div>

    <span class="slbl">Como os projetos são estruturados</span>
    <div class="g3">
      <div class="card">
        <div class="card-title">Portfólio</div>
        <p>O nível mais alto de organização. Um portfólio agrupa projetos e programas que pertencem ao mesmo objetivo estratégico da organização — por exemplo, "Expansão 2025" ou "Transformação Digital". Gestores usam o portfólio para ter uma visão panorâmica do que está em andamento em toda a empresa, sem precisar entrar em cada projeto individualmente.</p>
      </div>
      <div class="card">
        <div class="card-title">Programa</div>
        <p>Um nível intermediário que agrupa projetos relacionados. Imagine que a sua organização tem três projetos diferentes de tecnologia acontecendo ao mesmo tempo — eles podem estar dentro de um programa chamado "TI 2025". O programa permite ver o andamento de todos de uma vez e identificar dependências entre eles: se um projeto atrasa, o programa avisa o impacto nos demais.</p>
      </div>
      <div class="card">
        <div class="card-title">Projeto</div>
        <p>O nível onde o trabalho de fato acontece. Cada projeto tem nome, objetivo, data de início e fim, fases e entregáveis. Dentro do projeto você encontra o cronograma com todas as tarefas, os membros da equipe com seus papéis, os riscos identificados, as reuniões realizadas e os documentos relacionados. É aqui que você acompanha o dia a dia de execução.</p>
      </div>
    </div>

    <span class="slbl" style="margin-top:8px">O cronograma e as tarefas</span>
    <div class="g2">
      <div class="card">
        <div class="card-title">Como o cronograma funciona</div>
        <p>O cronograma de um projeto lista todas as tarefas com datas de início, prazo e responsável. Você pode visualizar em formato de lista ou como um gráfico de barras (chamado de Gantt), que mostra o tempo de cada tarefa em uma linha do tempo. As tarefas podem ter dependências entre si — por exemplo, a tarefa B só pode começar depois que a tarefa A for concluída. Se A atrasa, o sistema recalcula automaticamente o impacto em B e nas demais. Isso evita surpresas na entrega do projeto.</p>
      </div>
      <div class="card">
        <div class="card-title">Roadmap do projeto</div>
        <p>O roadmap é uma visão visual do projeto no tempo, focada nas fases e marcos principais — não em cada tarefa individualmente. É ideal para apresentações para liderança ou para comunicar o andamento geral sem entrar em detalhes. Você consegue exportar o roadmap em PDF diretamente pelo sistema para compartilhar em reuniões ou enviar por e-mail.</p>
      </div>
    </div>

    <span class="slbl" style="margin-top:8px">Reuniões</span>
    <div class="card">
      <div class="card-title">Como as reuniões funcionam no Radar F8</div>
      <p>Você pode agendar uma reunião dentro de um projeto, informando data, horário, local ou link e participantes. Antes da reunião, você registra a pauta — os assuntos que serão discutidos. Durante ou após a reunião, você preenche a ata: o que foi discutido, as decisões tomadas e, principalmente, os itens de ação — o que ficou combinado, quem vai fazer e até quando. A inteligência artificial do sistema pode ajudar a organizar e redigir a ata com base no que você registrou, economizando tempo. Cada item de ação fica automaticamente vinculado ao responsável que você indicou, e aparece no Meu Dia daquela pessoa na data combinada.</p>
    </div>

    <div class="hb">
      <div class="hbt">Por que a ata de reunião importa</div>
      <p>Reuniões sem ata são conversas que ninguém vai lembrar corretamente em duas semanas. A ata não é burocracia — é a garantia de que todos os presentes saíram com o mesmo entendimento do que foi decidido, quem é responsável pelo quê e qual o prazo. No Radar F8, a ata se torna automaticamente a origem dos planos de ação — o que foi combinado na reunião vira tarefa rastreável no sistema.</p>
    </div>

    <span class="slbl" style="margin-top:8px">Planos de ação</span>
    <div class="g2">
      <div class="card">
        <div class="card-title">O que é um plano de ação</div>
        <p>Um plano de ação é um conjunto de ações organizadas para atingir um objetivo. Cada ação tem: o que será feito (descrição clara da atividade), quem vai fazer (responsável único, não "a equipe"), até quando (prazo definido), onde será executado, por que é necessário e, quando relevante, quanto vai custar. No Radar F8 você pode anexar evidências de conclusão (fotos, documentos, prints) e deixar comentários para o responsável.</p>
      </div>
      <div class="card">
        <div class="card-title">Fluxo de um plano de ação</div>
        <p>Todo plano começa como rascunho, enquanto ainda está sendo montado. Quando está pronto, é publicado — a partir daí os responsáveis são notificados. Durante a execução, o sistema calcula automaticamente o percentual de conclusão com base nos itens marcados. Quando tudo estiver feito, o responsável pelo plano faz a validação final antes de marcar como concluído. Se alguma ação vence sem ser concluída, o sistema marca como atrasada e avisa o responsável e o gestor da área.</p>
      </div>
    </div>

    <div class="hb warn">
      <div class="hbt">Erros comuns ao usar planos de ação</div>
      <ul>
        <li><strong>Ação sem responsável único:</strong> "a equipe vai fazer" não funciona. Cada ação precisa ter uma pessoa específica — quem não é de ninguém, não é de ninguém.</li>
        <li><strong>Prazo muito longo sem marcos intermediários:</strong> uma ação com 3 meses de prazo sem etapas é difícil de acompanhar. Quebre em ações menores.</li>
        <li><strong>Evidência esquecida:</strong> marcar uma ação como concluída sem anexar evidência deixa o gestor sem como comprovar o resultado. Sempre anexe um documento, foto ou print.</li>
        <li><strong>Ação duplicada:</strong> antes de criar uma nova ação, verifique se ela já não existe em outro plano relacionado ao mesmo objetivo.</li>
      </ul>
    </div>

    <div class="divider"></div>
    <span class="slbl">Vídeos de apoio — em português</span>

    <a class="vc" href="https://www.youtube.com/watch?v=trhDHOC3xGw" target="_blank" rel="noopener" style="margin-bottom:18px">
      <div class="vci">
        <div class="vthumb" style="width:210px;"><div class="play"><div class="arr"></div></div></div>
        <div class="vinfo">
          <div class="vlbl">Gestão de Projetos</div>
          <div class="vtitle">Introdução à gestão de projetos — Aula 1</div>
          <div class="vdesc">O que é um projeto, como ele é estruturado na prática e como acompanhar o andamento de forma eficiente.</div>
          <span class="vcta">Assistir no YouTube</span>
        </div>
      </div>
    </a>

    <div class="vg">
      <a class="vc" href="https://www.youtube.com/watch?v=m4lZa1rsOjI" target="_blank" rel="noopener">
        <div class="vci">
          <div class="vthumb"><div class="play"><div class="arr"></div></div></div>
          <div class="vinfo">
            <div class="vlbl">Plano de ação</div>
            <div class="vtitle">Como montar um plano de ação eficiente</div>
            <div class="vdesc">Como preencher cada campo de um plano de ação de forma correta — responsável, prazo, descrição e evidência.</div>
            <span class="vcta">Assistir no YouTube</span>
          </div>
        </div>
      </a>
      <a class="vc" href="https://www.youtube.com/watch?v=kRM33jkeyO4" target="_blank" rel="noopener">
        <div class="vci">
          <div class="vthumb"><div class="play"><div class="arr"></div></div></div>
          <div class="vinfo">
            <div class="vlbl">Reuniões</div>
            <div class="vtitle">Como fazer uma boa ata de reunião</div>
            <div class="vdesc">O que deve constar em uma ata, como definir itens de ação claros e quem deve ser o responsável por cada um.</div>
            <span class="vcta">Assistir no YouTube</span>
          </div>
        </div>
      </a>
    </div>

    
  </div>`,
  's4': `<div class="content">
    <div class="step-header">
      <h2>GESTÃO DE <span>DOCUMENTOS</span></h2>
      <p>O módulo de documentos é o repositório oficial da organização. Aqui ficam armazenados, versionados e controlados todos os arquivos que precisam de gestão formal — contratos, procedimentos, normas, relatórios e qualquer outro documento que a equipe precise acessar com segurança.</p>
    </div>

    <span class="slbl">Como enviar e organizar documentos</span>
    <div class="g2">
      <div class="card">
        <div class="card-title">Enviando um documento</div>
        <p>Para enviar um arquivo, acesse o módulo de Documentos no menu lateral e clique em novo documento. Você vai fazer o upload do arquivo e preencher as informações de cadastro: título, tipo de documento, área responsável, tags (palavras-chave que facilitam a busca) e uma breve descrição do conteúdo. Quanto mais cuidado você tiver nesse preenchimento, mais fácil será para qualquer pessoa da equipe encontrar esse arquivo depois — mesmo meses ou anos depois do envio.</p>
      </div>
      <div class="card">
        <div class="card-title">Tags e classificação</div>
        <p>As tags são palavras-chave que você associa ao documento para facilitar a busca. Por exemplo, um contrato com a empresa XYZ pode ter as tags "contrato", "fornecedor", "XYZ" e "2025". Quando alguém buscar qualquer uma dessas palavras, esse documento vai aparecer nos resultados. Use tags que façam sentido para quem vai procurar o arquivo — não apenas para quem o criou. A área responsável também é importante: ela determina quem vê o documento por padrão.</p>
      </div>
    </div>

    <span class="slbl" style="margin-top:8px">Controle de versões</span>
    <div class="card">
      <div class="card-title">Por que o versionamento existe e como usar</div>
      <p>Documentos evoluem. Um procedimento operacional revisado, um contrato com aditivo, um relatório atualizado — todos são versões novas de um documento já existente. O Radar F8 mantém o histórico completo de todas as versões. Quando você envia uma versão nova, a anterior não é apagada — ela fica arquivada e acessível pelo histórico do documento. Isso garante rastreabilidade: sempre é possível saber o que o documento dizia em determinada data. Para enviar uma nova versão, abra o documento existente e use a opção "Nova versão" em vez de criar um novo cadastro do zero. Criar um novo cadastro para o mesmo documento gera duplicidade e confunde a equipe.</p>
    </div>

    <span class="slbl" style="margin-top:8px">Aprovação e controle de acesso</span>
    <div class="g2">
      <div class="card">
        <div class="card-title">Fluxo de aprovação</div>
        <p>Alguns documentos precisam de aprovação antes de ficarem disponíveis para todos. O administrador configura quais tipos de documento exigem esse fluxo. Quando você envia um documento que precisa de aprovação, ele fica no status "Aguardando revisão" e o responsável pela aprovação recebe uma notificação. Somente após a aprovação o documento aparece para os demais usuários. Se reprovado, o documento volta para o autor com os comentários do revisor para correção.</p>
      </div>
      <div class="card">
        <div class="card-title">Quem pode ver cada documento</div>
        <p>O acesso a cada documento é controlado individualmente. Um documento pode ser público — visível para todos os usuários do sistema; restrito a uma área — visível apenas para quem pertence àquela área; ou individual — acessível apenas para as pessoas que foram especificamente listadas. Você só vê o que foi liberado para você. Se precisar de acesso a um documento que não aparece para você, solicite ao responsável pelo documento ou ao administrador.</p>
      </div>
    </div>

    <span class="slbl" style="margin-top:8px">Busca inteligente</span>
    <div class="card">
      <div class="card-title">Como encontrar documentos rapidamente</div>
      <p>O sistema oferece dois tipos de busca. A busca por metadados procura pelo título, tags e área responsável — é a mais rápida quando você sabe o nome do arquivo. A busca semântica usa inteligência artificial para analisar o conteúdo do documento e encontrar arquivos mesmo quando você não lembra o nome exato — você pode descrever o assunto em palavras normais e o sistema traz os documentos mais relevantes. Essa segunda opção é especialmente útil para contratos, atas e relatórios longos onde o termo que você busca está dentro do texto.</p>
    </div>

    <div class="hb">
      <div class="hbt">Boas práticas ao enviar documentos</div>
      <ul>
        <li>Use nomes de arquivo descritivos antes de fazer o upload. "Contrato_XYZ_2025_v2.pdf" é melhor que "documento_final_final.pdf".</li>
        <li>Preencha as tags com cuidado — pense em que palavras alguém usaria para buscar este arquivo daqui a um ano.</li>
        <li>Se for uma versão nova de um arquivo existente, use o versionamento em vez de criar um novo cadastro.</li>
        <li>Associe o documento à área correta — isso determina quem pode encontrá-lo por padrão.</li>
        <li>Se o documento tiver dados sensíveis, restrinja o acesso antes de publicar.</li>
      </ul>
    </div>

    <div class="divider"></div>
    <span class="slbl">Vídeo de apoio — em português</span>

    <a class="vc" href="https://www.youtube.com/watch?v=VJWSqcXlRzI" target="_blank" rel="noopener">
      <div class="vci">
        <div class="vthumb" style="width:210px;"><div class="play"><div class="arr"></div></div></div>
        <div class="vinfo">
          <div class="vlbl">Gestão de documentos</div>
          <div class="vtitle">Gestão de documentos na empresa — conceito e prática</div>
          <div class="vdesc">Como organizar documentos corporativos de forma eficiente, controlar versões e garantir que a equipe acesse sempre a versão correta.</div>
          <span class="vcta">Assistir no YouTube</span>
        </div>
      </div>
    </a>

    
  </div>`,
  's5': `<div class="content">
    <div class="step-header">
      <h2><span>COMUNICADOS</span></h2>
      <p>O módulo de comunicados é o canal oficial da organização para avisos, instruções, políticas e informações que precisam chegar a todo mundo — com comprovação de que chegaram.</p>
    </div>

    <span class="slbl">Recebendo comunicados</span>
    <div class="g2">
      <div class="card">
        <div class="card-title">Como você é notificado</div>
        <p>Quando a organização envia um comunicado para você, duas coisas acontecem ao mesmo tempo: o sino de notificações na barra superior acende com um contador, e o comunicado aparece na sua tela de Recebidos. Dependendo da configuração do comunicado, ele pode exigir apenas leitura ou exigir que você clique em um botão de aceite confirmando que leu e entendeu o conteúdo. Esse registro fica salvo com data e hora e pode ser consultado pelo remetente.</p>
      </div>
      <div class="card">
        <div class="card-title">Comunicados que exigem aceite</div>
        <p>Alguns comunicados são mais do que informações — são confirmações formais. Por exemplo, uma nova política interna, uma instrução de segurança ou um aviso sobre mudança de procedimento. Nesses casos, o sistema exige que você clique em "Confirmar leitura" ou "Aceitar" antes de poder fechar o comunicado. Isso não é apenas protocolo — é a comprovação formal de que você foi informado e está ciente do conteúdo. Em caso de auditoria ou questionamento posterior, esse registro é a prova de que a informação chegou até você.</p>
      </div>
    </div>

    <span class="slbl" style="margin-top:8px">O que acontece se você não ler</span>
    <div class="card">
      <div class="card-title">Lembretes automáticos e prazos</div>
      <p>O remetente de um comunicado pode definir um prazo para leitura ou aceite. Se você não ler ou aceitar dentro desse prazo, o sistema envia lembretes automáticos — primeiro um aviso suave, depois com mais urgência, conforme o prazo se aproxima. O remetente também recebe uma lista mostrando quem já leu e quem ainda não leu, podendo acionar diretamente as pessoas que não responderam. Isso não é punição — é um mecanismo para garantir que informações importantes não se percam no volume de e-mails e mensagens do dia a dia.</p>
    </div>

    <span class="slbl" style="margin-top:8px">Enviando comunicados</span>
    <div class="g2">
      <div class="card">
        <div class="card-title">Quem pode enviar</div>
        <p>A capacidade de criar e enviar comunicados depende do seu perfil. Usuários com perfil de operador ou administrador podem criar comunicados. Usuários com perfil de visualizador apenas recebem. Se você precisar enviar um comunicado mas não encontrar essa opção no sistema, fale com o administrador para verificar seu perfil de acesso.</p>
      </div>
      <div class="card">
        <div class="card-title">Como criar um comunicado</div>
        <p>Ao criar um comunicado, você define o título, o conteúdo, os destinatários (pode ser um usuário específico, uma área inteira ou um grupo de notificação pré-configurado), se exige aceite ou apenas leitura, e o prazo. Você pode anexar arquivos ao comunicado — útil para compartilhar um documento junto com o aviso. Depois de enviado, o comunicado aparece na sua tela de Enviados e você acompanha em tempo real quem já leu e quem ainda não leu na tela de Acompanhamento.</p>
      </div>
    </div>

    <span class="slbl" style="margin-top:8px">Histórico e acompanhamento</span>
    <div class="card">
      <div class="card-title">As três telas do módulo de comunicados</div>
      <p>O módulo tem três telas principais. A tela de <strong>Recebidos</strong> lista todos os comunicados que chegaram para você, com indicação de quais já foram lidos e quais ainda estão pendentes — os pendentes ficam em destaque no topo. A tela de <strong>Enviados</strong> mostra os comunicados que você criou e enviou, com o status de cada um. A tela de <strong>Acompanhamento</strong> é a mais detalhada: ela mostra destinatário por destinatário, com data e hora de leitura para quem já leu, e a situação dos que ainda não leram. É aqui que você identifica quem precisa de um contato direto.</p>
    </div>

    <div class="hb ok">
      <div class="hbt">Por que o sistema registra quem leu e quando</div>
      <p>Em organizações, especialmente as que trabalham com conformidade, qualidade ou segurança, é necessário comprovar que instruções importantes chegaram a todos os envolvidos. O rastreio de leitura e aceite do Radar F8 cria essa comprovação de forma automática e confiável. Em uma auditoria, por exemplo, é possível mostrar exatamente quando cada colaborador leu determinada política interna. Isso protege tanto a organização quanto os próprios colaboradores.</p>
    </div>

    
  </div>`,
  's6': `<div class="content">
    <div class="step-header">
      <h2>PRIVACIDADE DOS <span>SEUS DADOS</span></h2>
      <p>O Radar F8 coleta e armazena alguns dados seus para funcionar. Esta seção explica exatamente quais são esses dados, por que eles existem e quais direitos você tem sobre eles.</p>
    </div>

    <span class="slbl">Quais dados o sistema armazena sobre você</span>
    <div class="g2">
      <div class="card">
        <div class="card-title">Dados de cadastro</div>
        <p>Nome completo, e-mail, telefone, foto de perfil e a área da organização a que você pertence. Esses dados são necessários para identificar você dentro do sistema, atribuir tarefas ao responsável correto e direcionar notificações para as pessoas certas. Sem esses dados, o sistema não consegue funcionar como uma ferramenta colaborativa.</p>
      </div>
      <div class="card">
        <div class="card-title">Dados de uso e atividade</div>
        <p>O sistema registra as ações que você realiza: quando entrou, o que criou, editou ou excluiu, quais documentos acessou e quando leu cada comunicado. Esses registros têm dois propósitos: garantir a rastreabilidade das operações (quem fez o quê e quando) e detectar qualquer uso indevido da conta — por exemplo, se alguém acessar sua conta sem sua autorização, os registros mostram as ações realizadas.</p>
      </div>
    </div>

    <span class="slbl" style="margin-top:8px">Por que você precisa aceitar os termos</span>
    <div class="card">
      <div class="card-title">O que são e por que existem os documentos legais</div>
      <p>A Lei Geral de Proteção de Dados (Lei 13.709/2018) exige que toda organização informe claramente aos seus usuários quais dados pessoais são coletados, para quê são usados, por quanto tempo são guardados e com quem podem ser compartilhados. A <strong>Política de Privacidade</strong> responde a essas perguntas. Os <strong>Termos de Uso</strong> descrevem as regras de utilização da plataforma — o que você pode e não pode fazer. A <strong>Política de Cookies</strong> explica os arquivos temporários que o sistema guarda no seu navegador para manter sua sessão ativa e lembrar suas preferências. Ao aceitar esses três documentos, você confirma que foi informado. Esse aceite fica registrado com data e hora no sistema.</p>
    </div>

    <span class="slbl" style="margin-top:8px">Seus direitos garantidos por lei</span>
    <div class="g2">
      <div class="card">
        <div class="card-title">Acesso e exportação dos seus dados</div>
        <p>Você tem o direito de saber exatamente quais dados seus estão armazenados no sistema e de receber uma cópia deles. No Radar F8, isso está disponível diretamente no seu perfil: basta clicar em "Exportar meus dados" e o sistema gera um arquivo com todas as suas informações pessoais. Você não precisa pedir autorização nem aguardar aprovação — é um direito seu e o sistema executa imediatamente.</p>
      </div>
      <div class="card">
        <div class="card-title">Correção e remoção dos seus dados</div>
        <p>Se alguma informação no seu perfil estiver errada, você pode corrigir diretamente na tela de Meu Perfil. Para dados que não aparecem na tela de perfil, solicite a correção ao administrador. Quanto à remoção: se você encerrar o vínculo com a organização, pode solicitar que seus dados pessoais sejam removidos. O sistema faz a anonimização do perfil — seu nome e dados pessoais são apagados, mas os registros de trabalho (atas, planos de ação, projetos) são preservados para não comprometer a rastreabilidade da organização, apenas sem identificação pessoal sua.</p>
      </div>
    </div>

    <div class="hb ok">
      <div class="hbt">Resumo dos seus direitos como usuário</div>
      <ul>
        <li>Saber quais dados seus estão armazenados no sistema.</li>
        <li>Receber uma cópia dos seus dados pessoais a qualquer momento.</li>
        <li>Solicitar a correção de informações incorretas no seu perfil.</li>
        <li>Pedir a remoção (anonimização) dos seus dados ao encerrar o vínculo com a organização.</li>
        <li>Ler a Política de Privacidade completa a qualquer momento dentro da própria plataforma.</li>
        <li>Solicitar informações sobre com quem seus dados foram compartilhados, caso aplicável.</li>
      </ul>
    </div>

    <div class="divider"></div>
    <span class="slbl">Vídeo de apoio — em português</span>

    <a class="vc" href="https://www.youtube.com/watch?v=n3e0HVcNml0" target="_blank" rel="noopener">
      <div class="vci">
        <div class="vthumb" style="width:210px;"><div class="play"><div class="arr"></div></div></div>
        <div class="vinfo">
          <div class="vlbl">Lei de proteção de dados</div>
          <div class="vtitle">LGPD: resumo em 4 minutos</div>
          <div class="vdesc">O que é a lei, por que ela foi criada e como ela protege seus dados pessoais no dia a dia — canal ME Explica, em português.</div>
          <span class="vcta">Assistir no YouTube</span>
        </div>
      </div>
    </a>

    <div class="hb ok" style="margin-top:24px">
      <div class="hbt">Privacidade entendida — próximo passo</div>
      <p>Você já conhece seus direitos e como o sistema cuida dos seus dados. Na próxima seção, veja como acompanhar o desempenho do seu trabalho por meio de métricas, indicadores e KPIs.</p>
    </div>

    
  </div>`,
  's7': `<div class="content">
    <div class="step-header">
      <h2>MÉTRICAS, INDICADORES<br><span>E KPIs</span></h2>
      <p>O Radar F8 registra o andamento de tudo que acontece na plataforma. Esta seção explica o que são métricas, indicadores e KPIs, por que eles existem e como usar essas informações para tomar decisões melhores no seu dia a dia.</p>
    </div>

    <span class="slbl">Entendendo os conceitos</span>
    <div class="g3">
      <div class="card">
        <div class="card-title">O que é uma métrica</div>
        <p>Uma métrica é qualquer número que o sistema mede e registra. Exemplos: quantas tarefas foram criadas, quantas foram concluídas, quantos documentos existem, quantos comunicados foram lidos. As métricas são os dados brutos — os fatos do que aconteceu. Sozinhas, elas descrevem a realidade, mas não dizem se ela é boa ou ruim. Para isso, você precisa de um indicador.</p>
      </div>
      <div class="card">
        <div class="card-title">O que é um indicador</div>
        <p>Um indicador é uma métrica colocada em contexto. Em vez de dizer "temos 40 ações em atraso", um indicador diz "30% das ações estão em atraso — e no mês passado eram 18%". Esse contexto — a comparação com um período anterior, com uma meta ou com uma referência — é o que transforma um número solto em uma informação útil. Indicadores respondem à pergunta: estamos indo bem ou mal neste aspecto?</p>
      </div>
      <div class="card">
        <div class="card-title">O que é um KPI</div>
        <p>KPI é a sigla em inglês para Indicador-Chave de Desempenho. De todos os indicadores possíveis, os KPIs são os mais importantes — os que, se estiverem fora do esperado, exigem atenção imediata. Uma organização pode ter dezenas de indicadores, mas define apenas 5 ou 10 KPIs. Eles representam o que não pode falhar. No Radar F8, os KPIs são definidos pela gestão e acompanhados no dashboard para que todos saibam, de relance, se os resultados estão dentro do esperado.</p>
      </div>
    </div>

    <div class="hb">
      <div class="hbt">Um exemplo prático para fixar a diferença</div>
      <p>Imagine que você gerencia planos de ação de uma área. A <strong>métrica</strong> é: 12 ações foram concluídas este mês. O <strong>indicador</strong> é: taxa de conclusão de 75% — de 16 ações previstas, 12 foram concluídas. O <strong>KPI</strong> é: a meta da organização é 80% de conclusão. Você está 5 pontos abaixo da meta. Agora você tem uma informação acionável — sabe que está abaixo, quanto está abaixo, e pode investigar quais das 4 ações restantes atrasaram e por quê.</p>
    </div>

    <span class="slbl" style="margin-top:8px">O que o Radar F8 mede automaticamente</span>
    <div class="g2">
      <div class="card">
        <div class="card-title">Progresso de projetos</div>
        <p>O sistema calcula automaticamente o percentual de conclusão de cada projeto com base nas tarefas marcadas como concluídas em relação ao total do cronograma. Você não precisa preencher nenhum número — basta atualizar as tarefas e o progresso aparece no painel do projeto. O mesmo vale para fases e entregáveis: cada nível tem seu percentual calculado de forma independente.</p>
      </div>
      <div class="card">
        <div class="card-title">Atraso e prazo de tarefas</div>
        <p>O sistema compara a data atual com o prazo de cada tarefa. Tarefas cujo prazo passou e ainda não foram concluídas são marcadas automaticamente como "em atraso" e ficam destacadas no painel do projeto, no Meu Dia do responsável e nos relatórios da área. Quanto mais tarefas em atraso, maior o risco de o projeto não ser entregue no prazo.</p>
      </div>
      <div class="card">
        <div class="card-title">Taxa de conclusão de planos de ação</div>
        <p>Para cada plano de ação, o sistema calcula quantas ações foram concluídas, quantas estão em execução e quantas estão em atraso. Esse percentual aparece na tela do plano e no painel da área responsável. Gestores usam essa informação para identificar quais áreas ou projetos precisam de atenção antes que os atrasos se acumulem.</p>
      </div>
      <div class="card">
        <div class="card-title">Leitura e aceite de comunicados</div>
        <p>O sistema mede em tempo real quantas pessoas de um grupo de destinatários já leram e aceitaram cada comunicado. Esse percentual é exibido na tela de acompanhamento. Quando o prazo se aproxima e a taxa de leitura ainda está baixa, o remetente pode acionar os que ainda não responderam — manualmente ou via lembrete automático.</p>
      </div>
    </div>

    <span class="slbl" style="margin-top:8px">Do número à decisão</span>
    <div class="card">
      <div class="card-title">Como usar indicadores no dia a dia</div>
      <p>Ver um indicador vermelho no dashboard não é o fim — é o começo de uma investigação. O fluxo correto é: identificar o indicador fora do esperado, entrar no detalhe (qual projeto, qual área, qual tarefa específica está causando o desvio), entender a causa (o responsável está sobrecarregado? houve um imprevisto? o prazo foi mal estimado?) e então tomar uma ação: redistribuir tarefas, ajustar o prazo com o gestor, acionar um recurso adicional ou comunicar o risco para a liderança. O sistema dá a informação — a decisão é sua.</p>
    </div>

    <div class="g2">
      <div class="card">
        <div class="card-title">Quando um número bom pode enganar</div>
        <p>Uma taxa de conclusão de 90% parece ótima — mas se os 10% restantes são as tarefas mais críticas do projeto, o resultado final pode estar comprometido. Por isso, indicadores nunca devem ser lidos isoladamente. Sempre pergunte: quais são as ações que ainda estão em aberto? Elas são críticas para a entrega? O prazo final está em risco? O sistema mostra os números, mas o julgamento sobre o que eles significam para o seu projeto é seu.</p>
      </div>
      <div class="card">
        <div class="card-title">Frequência de acompanhamento</div>
        <p>Projetos de curto prazo (semanas) exigem revisão diária. Projetos de médio e longo prazo (meses) pedem revisão semanal ou quinzenal. A recomendação geral: revise o Meu Dia todos os dias, revise os painéis dos projetos da sua área pelo menos uma vez por semana, e leve os KPIs para a reunião de gestão na periodicidade definida pela sua organização.</p>
      </div>
    </div>

    <span class="slbl" style="margin-top:8px">Glossário rápido</span>
    <div class="g3">
      <div class="card">
        <div class="card-title">Baseline</div>
        <p>O valor de referência com o qual os resultados são comparados. Se o projeto começou com 30 dias de prazo e 15 tarefas, esses são os valores de baseline. Qualquer desvio é medido a partir deles.</p>
      </div>
      <div class="card">
        <div class="card-title">Meta</div>
        <p>O resultado que a organização definiu como alvo para um indicador. Exemplo: meta de 85% de ações concluídas no prazo. A meta transforma um indicador em KPI quando ela representa algo crítico para o desempenho.</p>
      </div>
      <div class="card">
        <div class="card-title">Desvio</div>
        <p>A diferença entre o planejado e o realizado. Um desvio positivo significa que o resultado superou a meta. Um desvio negativo significa que ficou abaixo. O sistema mostra o desvio em percentual para facilitar a comparação.</p>
      </div>
      <div class="card">
        <div class="card-title">Dashboard</div>
        <p>A tela inicial do sistema que reúne os principais indicadores em um só lugar, em formato visual. É projetado para que você entenda rapidamente o estado geral dos projetos e ações da sua área sem precisar entrar em cada módulo individualmente.</p>
      </div>
      <div class="card">
        <div class="card-title">Semáforo</div>
        <p>A classificação visual dos indicadores por cor: verde (dentro do esperado), amarelo (atenção, está se aproximando do limite) e vermelho (fora do esperado, requer ação imediata). O sistema usa essa lógica nos painéis de projeto e nos relatórios de área.</p>
      </div>
      <div class="card">
        <div class="card-title">Evidência</div>
        <p>O arquivo que comprova que uma ação foi concluída — foto, documento, print de tela. No Radar F8, evidências são anexadas antes de marcar uma ação como concluída. Sem evidência, a conclusão fica apenas declarada, não comprovada.</p>
      </div>
    </div>

    <div class="hb ok">
      <div class="hbt">O que o sistema calcula para você automaticamente</div>
      <ul>
        <li>Percentual de conclusão de projetos, fases e entregáveis — atualizado em tempo real.</li>
        <li>Tarefas em atraso por projeto, área e responsável.</li>
        <li>Taxa de conclusão de planos de ação com comparativo entre períodos.</li>
        <li>Percentual de leitura e aceite de comunicados por destinatário e grupo.</li>
        <li>Progresso geral do portfólio e dos programas para a liderança.</li>
      </ul>
    </div>

    <div class="divider"></div>
    <span class="slbl">Vídeos de apoio — em português</span>

    <div class="vg">
      <a class="vc" href="https://www.youtube.com/watch?v=EIp1YZpJ2Mw" target="_blank" rel="noopener">
        <div class="vci">
          <div class="vthumb"><div class="play"><div class="arr"></div></div></div>
          <div class="vinfo">
            <div class="vlbl">Indicadores</div>
            <div class="vtitle">O que são indicadores de desempenho</div>
            <div class="vdesc">Conceito de indicador, diferença entre dado e informação, e como usar indicadores para tomar decisões melhores.</div>
            <span class="vcta">Assistir no YouTube</span>
          </div>
        </div>
      </a>
      <a class="vc" href="https://www.youtube.com/watch?v=3HWqUfTUgps" target="_blank" rel="noopener">
        <div class="vci">
          <div class="vthumb"><div class="play"><div class="arr"></div></div></div>
          <div class="vinfo">
            <div class="vlbl">KPI</div>
            <div class="vtitle">O que é KPI e como definir os seus</div>
            <div class="vdesc">Como escolher os indicadores-chave certos para o seu projeto ou área, sem se perder em excesso de dados.</div>
            <span class="vcta">Assistir no YouTube</span>
          </div>
        </div>
      </a>
    </div>

    <div class="hb ok" style="margin-top:8px">
      <div class="hbt">Onboarding completo</div>
      <p>Você percorreu todas as seções. Agora faça o quiz para confirmar o que ficou — e se tiver alguma dúvida, volte à seção correspondente antes de responder.</p>
    </div>

    
  </div>`,
  'sup': `<div class="content">
    <div class="step-header">
      <h2><span>SUPORTE</span></h2>
      <p>Ficou com dúvida ou encontrou algum problema? Veja como acionar o suporte correto.</p>
    </div>

    <div class="g2">
      <div class="card">
        <div class="card-title">Não consigo entrar no sistema</div>
        <p>Verifique se o e-mail e a senha estão corretos. Se esqueceu a senha, clique em "Esqueci minha senha" na tela de login. Se a conta estiver bloqueada, contate o administrador da sua organização.</p>
      </div>
      <div class="card">
        <div class="card-title">Quero solicitar algo sobre meus dados pessoais</div>
        <p>Para exportar seus dados, corrigir informações ou solicitar a remoção, acesse seu perfil ou entre em contato pelo canal indicado na Política de Privacidade, disponível dentro do sistema.</p>
      </div>
      <div class="card">
        <div class="card-title">Encontrei um erro no sistema</div>
        <p>Anote o que estava fazendo, o que apareceu na tela e o endereço da página. Envie essas informações, junto com uma captura de tela se possível, para o administrador do sistema na sua organização.</p>
      </div>
      <div class="card">
        <div class="card-title">Tenho uma sugestão de melhoria</div>
        <p>Sugestões de novas funcionalidades ou melhorias de fluxo devem ser enviadas ao responsável pelo sistema na sua organização, que avalia e encaminha para a equipe de produto.</p>
      </div>
    </div>

    <div class="hb ok">
      <div class="hbt">Onboarding do Radar F8 concluído</div>
      <p>Você já tem tudo que precisa para começar a usar o sistema com autonomia. Guarde o link deste guia — ele é a referência oficial para novos usuários da sua equipe.</p>
    </div>

    
  </div>`,
};
