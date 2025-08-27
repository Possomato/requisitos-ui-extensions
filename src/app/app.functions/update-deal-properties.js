// For HubSpot API calls
const hubspot = require('@hubspot/api-client');

exports.main = async (context = {}) => {
  const { hs_object_id } = context.propertiesToSend;
  const { properties } = context.parameters;
  
  console.log('Updating deal properties for deal:', hs_object_id);
  console.log('Properties to update:', properties);
  
  const hubSpotClient = new hubspot.Client({
    accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
  });

  try {
    // Update deal properties
    const apiResponse = await hubSpotClient.crm.deals.basicApi.update(
      hs_object_id,
      {
        properties: properties
      }
    );

    console.log('Deal properties updated successfully');
    return { success: true, updated: Object.keys(properties) };

  } catch (error) {
    console.error('Error updating deal properties:', error);
    throw error;
  }
};
