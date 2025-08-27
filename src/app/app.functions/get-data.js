// For HubSpot API calls
const hubspot = require('@hubspot/api-client');
const fs = require('fs');
const path = require('path');

// Entry function of this module
exports.main = async (context = {}) => {
  const { hs_object_id } = context.propertiesToSend;
  
  console.log('Deal ID:', hs_object_id);
  
  try {
    // 1. Buscar line items
    const lineItems = await getLineItems(hs_object_id);
    console.log('Line items found:', lineItems.length);
    
    // 2. Carregar requirements de TODOS os arquivos JSON
    const requirements = loadRequirements();
    console.log('Requirements loaded:', requirements.length);
    
    // 3. Encontrar matches
    const matches = findMatches(lineItems, requirements);
    console.log('Matches found:', matches);
    
    if (matches.length === 0) {
      return { hasMatches: false };
    }
    
    // 4. Buscar propriedades do deal E seus metadados
    const dealData = await getDealPropertiesWithMetadata(hs_object_id, matches);
    
    return { 
      hasMatches: true, 
      matchedProducts: dealData 
    };
    
  } catch (error) {
    console.error('Error in main function:', error);
    return { hasMatches: false, error: error.message };
  }
};

// Function to load requirements from ALL JSON files in requirements folder
function loadRequirements() {
  try {
    const requirementsDir = path.join(__dirname, '../requirements');
    console.log('Requirements directory:', requirementsDir);
    
    // Verificar se a pasta existe
    if (!fs.existsSync(requirementsDir)) {
      console.warn('Requirements directory does not exist:', requirementsDir);
      return [];
    }
    
    const files = fs.readdirSync(requirementsDir);
    console.log('Files in requirements directory:', files);
    
    let allRequirements = [];
    
    // Carregar todos os arquivos .json
    files.forEach(file => {
      if (file.endsWith('.json')) {
        console.log(`📄 Loading requirements from: ${file}`);
        
        try {
          const filePath = path.join(requirementsDir, file);
          const data = fs.readFileSync(filePath, 'utf8');
          const fileRequirements = JSON.parse(data);
          
          // Adicionar ao array principal
          if (Array.isArray(fileRequirements)) {
            console.log(`   ✅ Loaded ${fileRequirements.length} requirements from ${file}`);
            allRequirements.push(...fileRequirements);
          } else {
            console.warn(`   ⚠️ File ${file} is not an array, skipping`);
          }
        } catch (fileError) {
          console.error(`   ❌ Error loading ${file}:`, fileError.message);
        }
      } else {
        console.log(`   ⏭️ Skipping non-JSON file: ${file}`);
      }
    });
    
    console.log(`🎯 Total requirements loaded: ${allRequirements.length}`);
    
    // Log dos SKUs carregados para debug
    const skus = allRequirements.map(req => req.sku);
    console.log('📋 SKUs loaded:', skus);
    
    return allRequirements;
    
  } catch (error) {
    console.error('❌ Error loading requirements:', error);
    return [];
  }
}

// Function to find matches between line items and requirements - LÓGICA MELHORADA
function findMatches(lineItems, requirements) {
  const matches = [];
  
  console.log('🔍 Starting match process...');
  console.log('🔍 Requirements SKUs available:', requirements.map(r => r.sku));
  
  for (const lineItem of lineItems) {
    const lineItemSku = lineItem.properties?.hs_product_id;
    console.log(`🔍 Checking line item SKU: "${lineItemSku}"`);
    
    if (lineItemSku) {
      let matchedRequirement = null;
      
      // TENTATIVA 1: Match exato
      matchedRequirement = requirements.find(req => req.sku === lineItemSku);
      if (matchedRequirement) {
        console.log(`✅ EXACT MATCH found: "${lineItemSku}" = "${matchedRequirement.sku}"`);
      } else {
        console.log(`❌ No exact match for: "${lineItemSku}"`);
        
        // TENTATIVA 2: Line item sem prefixo, requirement com prefixo
        const lineItemWithPrefixes = [
          `DOCU-GRAL-${lineItemSku}`,
          `DOCU-EDUC-${lineItemSku}`,
          `SERV-${lineItemSku}`,
          `CONS-${lineItemSku}`
        ];
        
        for (const prefixedSku of lineItemWithPrefixes) {
          matchedRequirement = requirements.find(req => req.sku === prefixedSku);
          if (matchedRequirement) {
            console.log(`✅ PREFIX MATCH found: "${lineItemSku}" -> "${matchedRequirement.sku}"`);
            break;
          }
        }
        
        // TENTATIVA 3: Requirement sem prefixo, line item com prefixo  
        if (!matchedRequirement) {
          // Extrair apenas o número do line item
          const lineItemNumber = lineItemSku.replace(/^[A-Z-]+/, '');
          
          matchedRequirement = requirements.find(req => {
            const reqNumber = req.sku.replace(/^[A-Z-]+/, '');
            return reqNumber === lineItemNumber;
          });
          
          if (matchedRequirement) {
            console.log(`✅ NUMBER MATCH found: "${lineItemSku}" -> "${matchedRequirement.sku}"`);
          }
        }
        
        // TENTATIVA 4: Match flexível (contém)
        if (!matchedRequirement) {
          matchedRequirement = requirements.find(req => 
            req.sku.includes(lineItemSku) || lineItemSku.includes(req.sku)
          );
          
          if (matchedRequirement) {
            console.log(`✅ FLEXIBLE MATCH found: "${lineItemSku}" <-> "${matchedRequirement.sku}"`);
          }
        }
      }
      
      if (matchedRequirement) {
        matches.push({
          lineItem: lineItem,
          requirement: matchedRequirement,
          productName: lineItem.properties?.name || 'Produto sem nome'
        });
      } else {
        console.log(`❌ NO MATCH FOUND for line item SKU: "${lineItemSku}"`);
      }
    } else {
      console.log('⚠️ Line item has no hs_product_id');
    }
  }
  
  console.log(`🎯 Total matches found: ${matches.length}`);
  return matches;
}

// Function to fetch line items associated with deal
async function getLineItems(dealId) {
  const hubSpotClient = new hubspot.Client({
    accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
  });

  try {
    const dealData = await hubSpotClient.crm.deals.basicApi.getById(
      dealId,
      undefined,
      undefined, 
      ['line_items'],
      false
    );

    if (!dealData.associations) {
      console.log('No associations found in deal');
      return [];
    }

    let lineItemsAssociation = dealData.associations['line items'] ||
                              dealData.associations['line_items'] || 
                              dealData.associations.line_items;

    if (!lineItemsAssociation || !lineItemsAssociation.results) {
      console.log('No line items association found');
      return [];
    }

    const lineItemIds = lineItemsAssociation.results.map((item) => item.id);
    console.log('Line item IDs found:', lineItemIds);
    
    if (lineItemIds.length === 0) {
      return [];
    }

    const lineItems = await hubSpotClient.crm.lineItems.batchApi.read({
      inputs: lineItemIds.map((id) => ({ id })),
      properties: ['name', 'hs_product_id']
    });

    console.log('Line items retrieved:', lineItems.results?.length || 0);
    
    // Log detalhado dos line items
    if (lineItems.results) {
      lineItems.results.forEach((item, index) => {
        console.log(`Line item ${index + 1}:`, {
          id: item.id,
          name: item.properties?.name,
          hs_product_id: item.properties?.hs_product_id
        });
      });
    }

    return lineItems.results || [];

  } catch (error) {
    console.error('Error fetching line items:', error);
    return [];
  }
}

// Function to get deal properties AND their metadata for matched products
async function getDealPropertiesWithMetadata(dealId, matches) {
  const hubSpotClient = new hubspot.Client({
    accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
  });

  try {
    // Coletar todas as propriedades necessárias
    const allProps = [];
    matches.forEach(match => {
      allProps.push(...match.requirement.propsDeal);
    });
    
    // Remover duplicatas
    const uniqueProps = [...new Set(allProps)];
    console.log('Fetching deal properties:', uniqueProps);
    
    // 1. Buscar o deal com as propriedades
    const dealData = await hubSpotClient.crm.deals.basicApi.getById(
      dealId,
      uniqueProps
    );
    
    // 2. Buscar metadados das propriedades
    const propertiesMetadata = {};
    for (const propName of uniqueProps) {
      try {
        const propData = await hubSpotClient.crm.properties.coreApi.getByName('deals', propName);
        
        // INCLUIR O LABEL/DISPLAYNAME ORIGINAL DO HUBSPOT
        propertiesMetadata[propName] = {
          type: propData.type,
          fieldType: propData.fieldType,
          options: propData.options ? propData.options.map(option => ({
            label: option.label || option.displayName || option.value,
            value: option.value
          })) : [],
          label: propData.label || propData.displayName || propName,
          description: propData.description || ''
        };
        
        console.log(`Property ${propName} label:`, propertiesMetadata[propName].label);
        
      } catch (error) {
        console.error(`Error fetching metadata for property ${propName}:`, error.message);
        // Default metadata se não conseguir buscar
        propertiesMetadata[propName] = {
          type: 'string',
          fieldType: 'text',
          options: [],
          label: propName,
          description: ''
        };
      }
    }
    
    // 3. Montar resposta
    const result = matches.map(match => ({
      productName: match.productName,
      sku: match.requirement.sku,
      properties: match.requirement.propsDeal.map(prop => ({
        name: prop,
        value: dealData.properties[prop] || '',
        metadata: propertiesMetadata[prop]
      }))
    }));
    
    console.log('Final result:', JSON.stringify(result, null, 2));
    return result;
    
  } catch (error) {
    console.error('Error fetching deal properties:', error);
    return [];
  }
}
