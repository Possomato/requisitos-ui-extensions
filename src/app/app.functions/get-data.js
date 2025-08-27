// For HubSpot API calls
const hubspot = require('@hubspot/api-client');

// Entry function of this module
exports.main = async (context = {}) => {
  const { hs_object_id } = context.propertiesToSend;
  
  console.log('🚀 === STARTING get-data function ===');
  console.log('📋 Deal ID:', hs_object_id);
  
  try {
    // 1. Buscar line items
    console.log('🔍 Step 1: Fetching line items...');
    const lineItems = await getLineItems(hs_object_id);
    console.log(`📊 Line items found: ${lineItems.length}`);
    
    // 2. Carregar requirements do GITHUB
    console.log('🔍 Step 2: Loading requirements from GitHub...');
    const requirements = await loadRequirementsFromGitHub();
    console.log(`📊 Requirements loaded: ${requirements.length}`);
    
    if (requirements.length === 0) {
      console.error('❌ NO REQUIREMENTS LOADED from GitHub!');
      return { 
        hasMatches: false, 
        error: 'No requirements loaded from GitHub'
      };
    }
    
    // 3. Encontrar matches
    console.log('🔍 Step 3: Finding matches...');
    const matches = findMatches(lineItems, requirements);
    console.log(`📊 Matches found: ${matches.length}`);
    
    if (matches.length === 0) {
      console.log('❌ No matches found between line items and requirements');
      return { 
        hasMatches: false,
        debug: {
          lineItemsCount: lineItems.length,
          requirementsCount: requirements.length,
          lineItemsSKUs: lineItems.map(li => li.properties?.hs_product_id),
          requirementsSKUs: requirements.map(r => r.sku)
        }
      };
    }
    
    // 4. Buscar propriedades do deal E seus metadados
    console.log('🔍 Step 4: Getting deal properties...');
    const dealData = await getDealPropertiesWithMetadata(hs_object_id, matches);
    
    console.log('✅ SUCCESS - returning matched products');
    return { 
      hasMatches: true, 
      matchedProducts: dealData 
    };
    
  } catch (error) {
    console.error('💥 FATAL ERROR in main function:', error);
    return { 
      hasMatches: false, 
      error: error.message,
      stack: error.stack 
    };
  }
};

// NOVA FUNÇÃO: Carregar requirements do GitHub via HTTP
async function loadRequirementsFromGitHub() {
  console.log('🌐 === LOADING REQUIREMENTS FROM GITHUB ===');
  
  // URLs dos seus arquivos JSON no GitHub (SUBSTITUA PELOS SEUS)
  const githubUrls = [
    'https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/requirements/products.json',
    // 'https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/requirements/services.json',
    // 'https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/requirements/documents.json'
  ];
  
  let allRequirements = [];
  
  for (const url of githubUrls) {
    try {
      console.log(`🔗 Fetching from: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`❌ HTTP Error ${response.status} for ${url}`);
        continue;
      }
      
      const jsonText = await response.text();
      console.log(`📊 Downloaded ${jsonText.length} characters from ${url}`);
      
      const fileRequirements = JSON.parse(jsonText);
      
      if (Array.isArray(fileRequirements)) {
        console.log(`✅ Loaded ${fileRequirements.length} requirements from GitHub file`);
        allRequirements.push(...fileRequirements);
        
        // Log dos primeiros itens para debug
        fileRequirements.slice(0, 2).forEach((req, idx) => {
          console.log(`   📋 Item ${idx + 1}:`, JSON.stringify(req));
        });
      } else {
        console.warn(`⚠️ GitHub file is not an array, skipping. Type: ${typeof fileRequirements}`);
      }
      
    } catch (fetchError) {
      console.error(`💥 Error fetching from ${url}:`, fetchError.message);
      // Não falhamos completamente, apenas logamos o erro
    }
  }
  
  console.log(`🎯 Total requirements loaded from GitHub: ${allRequirements.length}`);
  
  // Log dos SKUs carregados
  const skus = allRequirements.map(req => req.sku);
  console.log('📋 GitHub SKUs loaded:', skus);
  
  return allRequirements;
}

// Function to find matches between line items and requirements
function findMatches(lineItems, requirements) {
  const matches = [];
  
  console.log('🔍 === STARTING MATCH PROCESS ===');
  console.log('📊 Line items to process:', lineItems.length);
  console.log('📊 Requirements available:', requirements.length);
  
  console.log('📋 Available requirement SKUs:', requirements.map(r => r.sku));
  
  for (const lineItem of lineItems) {
    const lineItemSku = lineItem.properties?.hs_product_id;
    console.log(`🔍 Processing line item SKU: "${lineItemSku}"`);
    
    if (lineItemSku) {
      // Match direto pelo SKU
      let matchedRequirement = requirements.find(req => req.sku === lineItemSku);
      
      if (matchedRequirement) {
        console.log(`✅ EXACT MATCH found: "${lineItemSku}" = "${matchedRequirement.sku}"`);
        matches.push({
          lineItem: lineItem,
          requirement: matchedRequirement,
          productName: lineItem.properties?.name || 'Produto sem nome'
        });
        console.log(`✅ MATCH ADDED: ${lineItem.properties?.name}`);
      } else {
        console.log(`❌ NO MATCH FOUND for line item SKU: "${lineItemSku}"`);
      }
    } else {
      console.log('⚠️ Line item has no hs_product_id');
    }
  }
  
  console.log(`🎯 === MATCH PROCESS COMPLETE ===`);
  console.log(`📊 Total matches found: ${matches.length}`);
  return matches;
}

// Function to fetch line items associated with deal
async function getLineItems(dealId) {
  const hubSpotClient = new hubspot.Client({
    accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
  });

  try {
    console.log('🔍 Fetching deal data for ID:', dealId);
    const dealData = await hubSpotClient.crm.deals.basicApi.getById(
      dealId,
      undefined,
      undefined, 
      ['line_items'],
      false
    );

    if (!dealData.associations) {
      return [];
    }

    let lineItemsAssociation = dealData.associations['line items'] ||
                              dealData.associations['line_items'] || 
                              dealData.associations.line_items;

    if (!lineItemsAssociation || !lineItemsAssociation.results) {
      return [];
    }

    const lineItemIds = lineItemsAssociation.results.map((item) => item.id);
    console.log('📋 Line item IDs found:', lineItemIds);
    
    if (lineItemIds.length === 0) {
      return [];
    }

    const lineItems = await hubSpotClient.crm.lineItems.batchApi.read({
      inputs: lineItemIds.map((id) => ({ id })),
      properties: ['name', 'hs_product_id']
    });

    console.log('📊 Line items retrieved:', lineItems.results?.length || 0);
    
    if (lineItems.results) {
      lineItems.results.forEach((item, index) => {
        console.log(`📋 Line item ${index + 1}:`, {
          id: item.id,
          name: item.properties?.name,
          hs_product_id: item.properties?.hs_product_id
        });
      });
    }

    return lineItems.results || [];

  } catch (error) {
    console.error('💥 Error fetching line items:', error);
    return [];
  }
}

// Function to get deal properties AND their metadata for matched products
async function getDealPropertiesWithMetadata(dealId, matches) {
  const hubSpotClient = new hubspot.Client({
    accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
  });

  try {
    const allProps = [];
    matches.forEach(match => {
      allProps.push(...match.requirement.propsDeal);
    });
    
    const uniqueProps = [...new Set(allProps)];
    console.log('🔍 Fetching deal properties:', uniqueProps);
    
    const dealData = await hubSpotClient.crm.deals.basicApi.getById(
      dealId,
      uniqueProps
    );
    
    const propertiesMetadata = {};
    for (const propName of uniqueProps) {
      try {
        const propData = await hubSpotClient.crm.properties.coreApi.getByName('deals', propName);
        
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
        
      } catch (error) {
        console.error(`💥 Error fetching metadata for property ${propName}:`, error.message);
        propertiesMetadata[propName] = {
          type: 'string',
          fieldType: 'text',
          options: [],
          label: propName,
          description: ''
        };
      }
    }
    
    const result = matches.map(match => ({
      productName: match.productName,
      sku: match.requirement.sku,
      properties: match.requirement.propsDeal.map(prop => ({
        name: prop,
        value: dealData.properties[prop] || '',
        metadata: propertiesMetadata[prop]
      }))
    }));
    
    console.log('✅ Final result assembled successfully');
    return result;
    
  } catch (error) {
    console.error('💥 Error fetching deal properties:', error);
    return [];
  }
}
