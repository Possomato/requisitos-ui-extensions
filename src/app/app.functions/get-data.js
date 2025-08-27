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
    
    // 2. Carregar requirements
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

// Function to load requirements from JSON file
function loadRequirements() {
  try {
    const requirementsPath = path.join(__dirname, '../requirements/products.json');
    const data = fs.readFileSync(requirementsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading requirements:', error);
    return [];
  }
}

// Function to find matches between line items and requirements
function findMatches(lineItems, requirements) {
  const matches = [];
  
  for (const lineItem of lineItems) {
    const lineItemSku = lineItem.properties?.hs_product_id;
    console.log('Checking line item SKU:', lineItemSku);
    
    if (lineItemSku) {
      const requirement = requirements.find(req => req.sku === lineItemSku);
      if (requirement) {
        matches.push({
          lineItem: lineItem,
          requirement: requirement,
          productName: lineItem.properties?.name || 'Produto sem nome'
        });
      }
    }
  }
  
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
      return [];
    }

    let lineItemsAssociation = dealData.associations['line items'] ||
                              dealData.associations['line_items'] || 
                              dealData.associations.line_items;

    if (!lineItemsAssociation || !lineItemsAssociation.results) {
      return [];
    }

    const lineItemIds = lineItemsAssociation.results.map((item) => item.id);
    
    if (lineItemIds.length === 0) {
      return [];
    }

    const lineItems = await hubSpotClient.crm.lineItems.batchApi.read({
      inputs: lineItemIds.map((id) => ({ id })),
      properties: ['name', 'hs_product_id']
    });

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
          label: propData.label || propData.displayName || propName, // LABEL ORIGINAL!
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
    
    console.log('Properties metadata summary:', JSON.stringify(propertiesMetadata, null, 2));
    
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
