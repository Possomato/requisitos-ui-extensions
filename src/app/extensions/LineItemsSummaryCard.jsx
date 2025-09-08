import React, { useState, useEffect } from 'react';

import {
  Alert,
  LoadingSpinner,
  Text,
  Flex,
  Divider,
  Input,
  Select,
  Checkbox,
  ToggleGroup,
  DateInput,
  NumberInput,
  Button,
} from '@hubspot/ui-extensions';

import { hubspot } from '@hubspot/ui-extensions';

// Define the extension to be run within the Hubspot CRM
hubspot.extend(() => <RequirementsCard />);

// Define the Extension component
const RequirementsCard = () => {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasMatches, setHasMatches] = useState(false);
  const [matchedProducts, setMatchedProducts] = useState([]);
  const [propertyValues, setPropertyValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Request data from serverless function
    hubspot
      .serverless('get-data', {
        propertiesToSend: ['hs_object_id'],
      })
      .then((response) => {
        console.log('Response from serverless:', response);
        setHasMatches(response.hasMatches || false);
        setMatchedProducts(response.matchedProducts || []);
        
        // Inicializar valores das propriedades
        const initialValues = {};
        (response.matchedProducts || []).forEach(product => {
          product.properties.forEach(prop => {
            initialValues[prop.name] = prop.value;
          });
        });
        setPropertyValues(initialValues);
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        setErrorMessage(error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handlePropertyChange = (propertyName, newValue) => {
    console.log(`Property ${propertyName} changed from "${propertyValues[propertyName]}" to "${newValue}"`);
    setPropertyValues(prev => {
      const updated = {
        ...prev,
        [propertyName]: newValue
      };
      console.log('Updated propertyValues state:', updated);
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Preparar propriedades para salvar
      const properties = {};
      Object.keys(propertyValues).forEach(propName => {
        let valueToSave = propertyValues[propName];
        
        // Converter Sim/Não de volta para true/false se necessário
        if (valueToSave === 'Sim') {
          valueToSave = 'true';
        } else if (valueToSave === 'Não') {
          valueToSave = 'false';
        }
        
        properties[propName] = valueToSave;
      });

      console.log('Saving properties:', properties);
      
      // Usar serverless function para atualizar as propriedades
      const response = await hubspot.serverless('update-deal-properties', {
        parameters: { properties },
        propertiesToSend: ['hs_object_id'],
      });
      
      console.log('Properties updated successfully:', response);
      
      // Recarregar os dados do componente
      setLoading(true);
      hubspot
        .serverless('get-data', {
          propertiesToSend: ['hs_object_id'],
        })
        .then((response) => {
          console.log('Reloaded data after save:', response);
          setHasMatches(response.hasMatches || false);
          setMatchedProducts(response.matchedProducts || []);
          
          // Atualizar valores das propriedades com os novos dados
          const updatedValues = {};
          (response.matchedProducts || []).forEach(product => {
            product.properties.forEach(prop => {
              updatedValues[prop.name] = prop.value;
            });
          });
          setPropertyValues(updatedValues);
        })
        .finally(() => {
          setLoading(false);
        });
      
    } catch (error) {
      console.error('Error updating properties:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderPropertyField = (property) => {
    const { name, value, metadata } = property;
    const currentValue = propertyValues[name] || value || '';

    // LOG PARA DEBUG
    console.log(`Rendering field: ${name}`, { 
      type: metadata?.type, 
      fieldType: metadata?.fieldType, 
      currentValue,
      valueInState: propertyValues[name],
      originalValue: value,
      hasOptions: metadata?.options?.length > 0
    });

    // FORÇAR DETECÇÃO PARA CAMPOS QUE CONTÉM TRUE/FALSE - BOTÕES LARGOS
    if (currentValue === 'true' || currentValue === 'false' || 
        currentValue === true || currentValue === false ||
        metadata?.type === 'bool' || metadata?.type === 'boolean' ||
        metadata?.fieldType === 'booleancheckbox') {
      
      const booleanValue = currentValue === 'true' || currentValue === true || currentValue === 'Sim';
      const displayValue = currentValue === '' ? '' : (booleanValue ? 'Sim' : 'Não');
      
      const booleanOptions = [
        { label: 'Sim', value: 'Sim' },
        { label: 'Não', value: 'Não' }
      ];
      
      return (
        <Flex direction="column" gap="xs">
          {booleanOptions.map((option, idx) => (
            <Button
              key={idx}
              size="sm"
              variant={displayValue === option.value ? "primary" : "secondary"}
              onClick={() => {
                console.log(`Boolean option ${option.value} selected for ${name}`);
                handlePropertyChange(name, option.value);
              }}
            >
              {option.label}
            </Button>
          ))}
        </Flex>
      );
    }

    // DETECÇÃO DE SELECT COM OPÇÕES - BOTÕES LARGOS PADRONIZADOS
    if (metadata?.fieldType === 'select' || 
        metadata?.fieldType === 'dropdown' || 
        metadata?.fieldType === 'radio' ||
        (metadata?.options && metadata.options.length > 0)) {
      
      const selectOptions = metadata.options || [];
      
      console.log(`Select field ${name} options:`, selectOptions);
      console.log(`Select field ${name} current value: "${currentValue}"`);
      
      return (
        <Flex direction="column" gap="xs">
          {selectOptions.map((option, idx) => (
            <Button
              key={idx}
              size="sm"
              variant={currentValue === option.value ? "primary" : "secondary"}
              onClick={() => {
                console.log(`Option ${option.value} selected for ${name}`);
                handlePropertyChange(name, option.value);
              }}
            >
              {option.label}
            </Button>
          ))}
        </Flex>
      );
    }

    // DETECÇÃO DE CHECKBOX MÚLTIPLO
    if (metadata?.fieldType === 'checkbox' && metadata?.options && metadata.options.length > 1) {
      return (
        <ToggleGroup
          name={name}
          value={currentValue ? currentValue.split(';') : []}
          onSelectionChange={(selectedOptions) => {
            const newValue = selectedOptions.join(';');
            handlePropertyChange(name, newValue);
          }}
        >
          {metadata.options.map(option => (
            <Checkbox key={option.value} value={option.value}>
              {option.label || option.value}
            </Checkbox>
          ))}
        </ToggleGroup>
      );
    }

    // DETECÇÃO DE DATA
    if (metadata?.type === 'date' || 
        metadata?.type === 'datetime' || 
        metadata?.fieldType === 'date') {
      return (
        <DateInput
          name={name}
          value={currentValue}
          onInput={(date) => {
            console.log(`Date field ${name} changed to:`, date);
            handlePropertyChange(name, date);
          }}
        />
      );
    }

    // DETECÇÃO DE NÚMERO
    if (metadata?.type === 'number' || 
        metadata?.fieldType === 'number') {
      return (
        <NumberInput
          name={name}
          value={currentValue}
          onInput={(number) => {
            console.log(`Number field ${name} changed to:`, number);
            handlePropertyChange(name, number.toString());
          }}
        />
      );
    }

    // DETECÇÃO DE TEXTAREA - MÚLTIPLAS LINHAS
    if (metadata?.fieldType === 'textarea' || 
        metadata?.type === 'textarea' || 
        metadata?.type === 'text_area') {
      return (
        <Input
          name={name}
          value={currentValue}
          multiline
          rows={6}
          onInput={(text) => {
            console.log(`TextArea field ${name} changed to:`, text);
            handlePropertyChange(name, text);
          }}
          placeholder={metadata?.label || name}
        />
      );
    }

    // DEFAULT PARA TEXT
    return (
      <Input
        name={name}
        value={currentValue}
        onInput={(text) => {
          console.log(`Text field ${name} changed to:`, text);
          handlePropertyChange(name, text);
        }}
        placeholder={metadata?.label || name}
      />
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (errorMessage) {
    return (
      <Alert title="Erro ao carregar dados" variant="error">
        {errorMessage}
      </Alert>
    );
  }

  if (!hasMatches) {
    return (
      <Flex direction="column" gap="lg" align="center">
        <Text variant="microcopy" format={{ fontStyle: 'italic' }}>
          Não há entrada de requisitos, siga o playbook acima
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="xl">
      {matchedProducts.map((product, index) => (
        <Flex key={index} direction="column" gap="sm">
          {/* TÍTULO DO PRODUTO - ESTILIZADO */}
          <Text format={{ fontWeight: 'demibold', fontSize: 'medium' }}>
            {product.productName}
          </Text>
          
          <Flex direction="column" gap="sm">
            {product.properties.map((prop, propIndex) => (
              <Flex key={propIndex} direction="column" gap="sm">
                {/* CONTAINER PARA LABEL E DESCRIÇÃO COM ESPAÇAMENTO REDUZIDO */}
                <Flex direction="column" gap="xs">
                  {/* LABEL DA PROPRIEDADE - TÍTULO MAIOR E BOLD */}
                  <Text 
                    format={{ 
                      fontWeight: 'bold',
                      fontSize: 'default'
                    }}
                  >
                    {prop.metadata?.label || prop.name}
                  </Text>
                  
                  {/* DESCRIÇÃO DA PROPRIEDADE - ESPAÇAMENTO REDUZIDO */}
                  {prop.metadata?.description && (
                    <Text 
                      variant="microcopy" 
                      format={{ 
                        fontSize: 'small',
                        fontStyle: 'italic',
                        color: 'secondary'
                      }}
                    >
                      {prop.metadata.description}
                    </Text>
                  )}
                </Flex>
                
                {/* CAMPO INTERATIVO */}
                {renderPropertyField(prop)}
              </Flex>
            ))}
          </Flex>
          
          {/* DIVISOR ENTRE PRODUTOS */}
          {index < matchedProducts.length - 1 && (
            <Flex direction="column" gap="sm">
              <Divider />
            </Flex>
          )}
        </Flex>
      ))}
      
      {/* BOTÃO DE SALVAR - ESTILIZADO */}
      <Flex direction="column" gap="sm" align="center">
        <Button
          type="submit"
          variant="destructive"
          size="md"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
        
        {/* TEXTO DE AJUDA */}
        <Text variant="microcopy" format={{ fontSize: 'small', fontStyle: 'italic' }}>
          {saving ? 'Aguarde enquanto salvamos suas alterações...' : 'Clique para salvar todas as modificações'}
        </Text>
      </Flex>
    </Flex>
  );
};
