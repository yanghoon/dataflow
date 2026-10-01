import React, { useState } from 'react';
import Form from '@rjsf/mui';
import validator from '@rjsf/validator-ajv8';
import { Button, TextField, Box, Typography } from '@material-ui/core';

export const JobRunForm = ({ schema, onSubmit }: { schema?: any; onSubmit: (params: Record<string, any>) => void }) => {
  const [params, setParams] = useState<Record<string, string>>({});

  if (schema && Object.keys(schema).length > 0) {
    return (
      <Form
        schema={schema}
        validator={validator}
        onSubmit={(e) => onSubmit(e.formData)}
      >
        <Box mt={2}>
          <Button type="submit" variant="contained" color="primary">Run Job</Button>
        </Box>
      </Form>
    );
  }

  // Fallback mode
  const handleAddParam = () => {
    setParams(prev => ({ ...prev, '': '' }));
  };

  const handleParamChange = (oldKey: string, newKey: string, value: string) => {
    setParams(prev => {
      const next = { ...prev };
      if (oldKey !== newKey) {
        delete next[oldKey];
      }
      next[newKey] = value;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(params);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Typography variant="body1">No schema found. Using manual key-value parameters.</Typography>
      {Object.entries(params).map(([key, value], i) => (
        <Box key={i} display="flex" my={1}>
          <Box mr={2}>
            <TextField
              label="Key"
              value={key}
              onChange={(e) => handleParamChange(key, e.target.value, value)}
            />
          </Box>
          <TextField
            label="Value"
            value={value}
            onChange={(e) => handleParamChange(key, key, e.target.value)}
          />
        </Box>
      ))}
      <Box mt={2} display="flex">
        <Box mr={2}>
          <Button variant="outlined" onClick={handleAddParam}>Add Parameter</Button>
        </Box>
        <Button type="submit" variant="contained" color="primary">Run Job</Button>
      </Box>
    </form>
  );
};
