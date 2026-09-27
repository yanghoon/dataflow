import React, { useState } from 'react';
import { Page, Header, Content, HeaderLabel, Progress } from '@backstage/core-components';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Alert } from '@material-ui/lab';
import { useAsync } from 'react-use';

import { useApi, fetchApiRef } from '@backstage/core-plugin-api';

export const SettingsPage = () => {
  const [formData, setFormData] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fetchApi = useApi(fetchApiRef);

  const { loading, error } = useAsync(async () => {
    try {
      const res = await fetchApi.fetch('/api/config/settings');
      if (!res.ok) {
        throw new Error('Failed to load settings');
      }
      const data = await res.json();
      setSchema(data.schema);
      setFormData(data.data);
      return data;
    } catch (err: any) {
      console.error("Fetch error:", err);
      throw err;
    }
  }, [fetchApi]);

  const onSubmit = async (data: any) => {
    try {
      const res = await fetchApi.fetch('/api/config/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.formData)
      });
      
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error('Conflict: The settings were updated by someone else. Please refresh and try again.');
        }
        throw new Error('Failed to save settings.');
      }
      setFormData(data.formData);
      setErrorMsg(null);
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  return (
    <Page themeId="tool">
      <Header title="Settings" subtitle="Manage configuration">
        <HeaderLabel label="Owner" value="Admin" />
      </Header>
      <Content>
        {error && (
          <Alert severity="error" style={{ marginBottom: '16px' }}>
            {error.message}
          </Alert>
        )}
        {errorMsg && (
          <Alert severity="error" onClose={() => setErrorMsg(null)} style={{ marginBottom: '16px' }}>
            {errorMsg}
          </Alert>
        )}
        {loading && <Progress />}
        {!loading && !error && schema && (
          <Form
            schema={schema}
            validator={validator}
            formData={formData}
            onChange={e => setFormData(e.formData)}
            onSubmit={onSubmit}
            showErrorList={false}
          />
        )}
      </Content>
    </Page>
  );
};
