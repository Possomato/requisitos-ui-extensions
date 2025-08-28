# Coleta de requisitos | UI Extension Card 

Este projeto é uma extensão de UI para o HubSpot CRM que cria um card personalizado para gerenciar propriedades de deals baseado em line items. O card automaticamente detecta produtos em deals e carrega formulários dinâmicos com base em requisitos específicos de cada produto.

## Funcionalidades

- **Detecção Automática**: Identifica line items associados a um deal
- **Matching Inteligente**: Compara SKUs dos line items com requisitos pré-definidos
- **Formulários Dinâmicos**: Gera campos personalizados baseados nas propriedades de cada produto
- **Sincronização com GitHub**: Carrega requisitos automaticamente de um repositório GitHub
- **Interface Responsiva**: Campos adaptáveis (texto, select, checkbox, data, número, booleano)


## Configuração Inicial

### Passo 1: Atualizar CLI e Autenticar

1. Atualize para a versão mais recente da CLI: `npm install -g @hubspot/cli@latest`
2. Execute `hs init` se ainda não tiver um arquivo de configuração
3. Execute `hs auth` para autenticar sua conta, ou `hs accounts use` para selecionar uma conta já autenticada

### Passo 2: Clonar o Projeto

Na pasta onde deseja clonar o projeto, execute:
```bash
git clone [URL_DO_REPOSITORIO] line-items-summary
```

Ou se preferir usar a CLI do HubSpot para download:
```bash
hs project download --projectName="line-items-summary"
```

### Passo 3: Instalar Dependências

Navegue até o diretório do projeto e instale as dependências:
```bash
cd line-items-summary
npm install --prefix src/app/extensions
npm install --prefix src/app/app.functions
```

### Passo 4: Upload do Projeto

Execute `hs project upload` para fazer o upload inicial. Para desenvolvimento ativo, use `hs project dev` para ver as mudanças em tempo real.

## Como Usar

### No HubSpot CRM

1. Navegue até **Sales** > **Deals**
2. Abra qualquer deal que contenha line items
3. Procure pelo card **"Line Items Summary Card"** nas abas do deal
4. O card irá:
   - Detectar automaticamente os line items do deal
   - Comparar os SKUs com os requisitos do GitHub
   - Exibir formulários personalizados para cada produto encontrado
   - Permitir edição e salvamento das propriedades

### Estados do Card

- **"Siga o playbook"**: Aparece quando não há matches entre line items e requisitos
- **Formulários dinâmicos**: Aparece quando há produtos correspondentes, mostrando campos editáveis
- **Loading**: Durante o carregamento dos dados
- **Erro**: Em caso de problemas na comunicação

## Desenvolvimento Local

### Configuração do Ambiente

1. Instale as dependências: `npm install`
2. Crie um arquivo `.env` dentro da pasta `src/app/app.functions/`
3. No HubSpot, navegue até **CRM development** > **Private apps**
4. Encontre o app "Line Items summary example app" e copie o access token
5. Adicione ao arquivo `.env`:
   ```
   PRIVATE_APP_ACCESS_TOKEN="seu_token_aqui"
   ```

### Iniciar Desenvolvimento

Execute `hs project dev` para iniciar o modo de desenvolvimento. Isso permitirá ver mudanças em tempo real no CRM.

## Editando Requisitos via GitHub

### Estrutura do Arquivo requisitos.json

O arquivo de requisitos fica em `src/app/requirements/requisitos.json` e segue esta estrutura:

```json
[
  [
    {
      "sku": "CONS-FISC-24665292896",
      "propsDeal": ["quais_sao_as_duvidas_do_cliente_"]
    },
    {
      "sku": "CONS-EDUC-24664410983", 
      "propsDeal": ["qual_curso_o_cliente_tem_interesse_"]
    }
  ],
  [
    {
      "sku": "CURS-CURS-00001469",
      "propsDeal": ["em_qual_curso_o_cliente_tem_interesse_"]
    }
  ]
]
```

### Como Editar pelo GitHub

#### Método 1: Interface Web do GitHub

1. **Acesse o repositório** no GitHub
2. **Navegue até o arquivo**: `src/app/requirements/requisitos.json`
3. **Clique no ícone de lápis** (Edit this file) no canto superior direito
4. **Faça suas alterações** seguindo a estrutura JSON
5. **Adicione uma mensagem de commit** descritiva
6. **Clique em "Commit changes"**

#### Método 2: Criar Nova Branch (Recomendado)

1. **Crie uma nova branch** antes de editar:
   - Clique em "Create a new branch for this commit"
   - Nomeie a branch (ex: `update-requirements-2024-01`)
2. **Faça as alterações** no arquivo
3. **Commit na nova branch**
4. **Crie um Pull Request** para revisar as mudanças antes de aplicar

### Regras para Edição

#### Estrutura Obrigatória
- **Array de arrays**: O arquivo deve conter um array principal com sub-arrays
- **Objetos de requisito**: Cada item deve ter `sku` (string) e `propsDeal` (array)

#### Exemplo de Adição
```json
{
  "sku": "NOVO-PRODUTO-123",
  "propsDeal": [
    "nova_propriedade_customizada",
    "outra_propriedade_importante"
  ]
}
```

#### Matching de SKUs
O sistema faz matching flexível:
- **Exato**: `CONS-FISC-123` = `CONS-FISC-123`
- **Sufixo**: Line item `123` encontra requirement `CONS-FISC-123`
- **Número**: Line item `123` encontra requirement com número `123`

### Validação Automática

Após editar o arquivo:
1. **O sistema valida** automaticamente a estrutura JSON
2. **Erros são logados** no console do HubSpot para debug
3. **Mudanças são aplicadas** imediatamente nos cards ativos

### Melhores Práticas

- **Sempre valide o JSON** antes de fazer commit
- **Use nomes descritivos** nos commits (ex: "Adicionar requisitos para produtos educacionais")
- **Teste as mudanças** em ambiente sandbox primeiro
- **Documente SKUs novos** em comentários do commit
- **Mantenha backup** dos requisitos importantes

### Exemplo de Fluxo Completo

1. **Identificar novo produto**: SKU `SERV-CONT-456`
2. **Definir propriedades necessárias**: `["tipo_servico", "prazo_entrega"]`
3. **Editar requisitos.json**:
   ```json
   {
     "sku": "SERV-CONT-456",
     "propsDeal": ["tipo_servico", "prazo_entrega"]
   }
   ```
4. **Commit com mensagem**: "Adicionar requisitos para serviços de contabilidade"
5. **Verificar no HubSpot**: Deals com line item `SERV-CONT-456` mostrarão os novos campos

## Arquitetura Técnica

### Fluxo de Dados

1. **get-data.js**: Busca line items do deal e carrega requisitos do GitHub
2. **Matching**: Compara SKUs e encontra correspondências
3. **Metadata**: Busca informações das propriedades do HubSpot
4. **Renderização**: Componente React gera formulários dinâmicos
5. **update-deal-properties.js**: Salva alterações de volta no HubSpot

### Componentes Principais

- **LineItemsSummaryCard.jsx**: Interface React principal
- **get-data.js**: Função serverless para buscar dados
- **update-deal-properties.js**: Função serverless para salvar dados
- **requisitos.json**: Base de dados de requisitos (GitHub)

### Tipos de Campos Suportados

- **Texto**: Input livre
- **Select**: Dropdown com opções predefinidas
- **Checkbox**: Seleção múltipla
- **Booleano**: Botões Sim/Não
- **Data**: Seletor de data
- **Número**: Input numérico

## Troubleshooting

### Card mostra "Siga o playbook"
- Verifique se o deal tem line items associados
- Confirme se os SKUs dos line items existem nos requisitos
- Verifique logs no console para detalhes do matching

### Erro ao carregar dados
- Confirme se o token de acesso está configurado corretamente
- Verifique se o arquivo requisitos.json tem estrutura JSON válida
- Confirme se as propriedades existem no HubSpot

### Campos não aparecem corretamente
- Verifique se as propriedades estão criadas no HubSpot
- Confirme os tipos de campo no HubSpot (text, select, boolean, etc.)
- Verifique logs do navegador para erros de renderização

## Documentação Adicional

- [Documentação completa da HubSpot CLI](https://developers.hubspot.com/docs/guides/crm/setup)
- [Guia de desenvolvimento local](https://developers.hubspot.com/docs/guides/crm/private-apps/quickstart#3.-start-local-development)
- [Gerenciamento de secrets](https://developers.hubspot.com/docs/guides/crm/private-apps/serverless-functions#managing-secrets)
