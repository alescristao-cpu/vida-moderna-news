# Sistema Vida Moderna News — Player Android & Painel Administrativo

Sistema completo de Mídia Indoor para elevadores e condomínios (**Modern Life Residence**) com sincronização 100% automática via Wi-Fi:

## 📐 Especificações Técnicas Implementadas
- **Formato Total da Tela:** `1280 x 720 px` (proporção 16:9, escalonado automaticamente para qualquer tablet ou TV Box Android).
- **Área de Publicidade / Cartela / Vídeo / Notícias (Topo):** `1280 x 520 px` com resolução de **72 dpi**.
- **Tempo Padrão de Exibição:** **15 segundos** (`15"`), reservando de **3" a 5"** finais para destaque da assinatura e contatos (telefone, site, e-mail, endereço).
- **Quadro de Recados do Condomínio (Base `1280 x 200 px`):** Postados e atualizados de forma **100% independente da arte/publicidade**, com etiqueta `INFORMAÇÕES DO CONDOMÍNIO`, logo **Modern Life Residence** (`assets/logo-modern-life.png`) e assinatura **Vida Moderna News**.
- **Sincronização 100% Automática via Wi-Fi:** Toda vez que o aparelho Android captar a rede Wi-Fi (mesmo após ficar offline nos andares do elevador), o sistema baixa automaticamente os novos recados, cartelas/vídeos e notícias do G1, salvando em cache offline (`Cache Storage` + `localStorage`).

---

## 🚀 Como Iniciar o Sistema no Windows (1 Clique)

1. Dê duplo clique no arquivo [`iniciar_sistema.bat`](./iniciar_sistema.bat) (ou execute `powershell -ExecutionPolicy Bypass -File .\server.ps1`).
2. O sistema abrirá automaticamente:
   - **Painel Administrativo (Vida Moderna News):** `http://localhost:8080/admin.html`
   - **Tela Player Android (1280x720px):** `http://localhost:8080/index.html`
