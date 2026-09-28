import { useState } from 'react';
import { Page, Header, Content, HeaderLabel, Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { Alert } from '@material-ui/lab';
import { useAsync } from 'react-use';
import { settingsApiRef, DirtySettingItem, SettingItem } from '../../api';
import { TextField, Switch, Select, MenuItem, Button, Typography, Box, Paper } from '@material-ui/core';

import { AddSettingDialog } from './AddSettingDialog';

export const SettingsPage = () => {
  const settingsApi = useApi(settingsApiRef);
  const [items, setItems] = useState<DirtySettingItem[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const onAddSetting = async (newItem: SettingItem) => {
    try {
      await settingsApi.addConfig(newItem);
      // reload items
      const data = await settingsApi.getConfigs();
      setItems(data.map(item => ({ ...item, isDirty: false, originalValue: item.value })));
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const { loading, error } = useAsync(async () => {
    try {
      const data = await settingsApi.getConfigs();
      setItems(data.map(item => ({ ...item, isDirty: false, originalValue: item.value })));
      return data;
    } catch (err: any) {
      console.error("Fetch error:", err);
      throw err;
    }
  }, [settingsApi]);

  const handleChange = (key: string, newValue: any) => {
    setItems(prev => prev.map(item => {
      if (item.key === key) {
        const isDirty = item.originalValue !== newValue;
        return { ...item, value: newValue, isDirty };
      }
      return item;
    }));
  };

  const onSave = async () => {
    try {
      const dirtyItems = items.filter(i => i.isDirty);
      if (dirtyItems.length === 0) return;
      
      const payload: SettingItem[] = dirtyItems.map(({ isDirty, originalValue, ...rest }) => rest);
      await settingsApi.updateConfigs(payload);
      
      setItems(prev => prev.map(item => ({ ...item, isDirty: false, originalValue: item.value })));
      setErrorMsg(null);
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const filteredItems = items.filter(item => 
    item.key.toLowerCase().includes(searchText.toLowerCase()) || 
    item.label.toLowerCase().includes(searchText.toLowerCase())
  );

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
        {!loading && !error && (
          <Box display="flex" flexDirection="column">
            <Box mb={2} display="flex" alignItems="center" justifyContent="space-between">
              <Box flex={1} mr={2}>
                <TextField 
                  placeholder="Search settings..."
                  variant="outlined"
                  fullWidth
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  inputProps={{ 'aria-label': 'search settings' }}
                />
              </Box>
              <Button variant="outlined" color="primary" onClick={() => setDialogOpen(true)}>
                + Add Setting
              </Button>
            </Box>
            
            <Paper>
              {filteredItems.map(item => (
                <Box key={item.key} display="flex" justifyContent="space-between" alignItems="center" p={2} borderBottom="1px solid #eee">
                  <Box flex={1} mr={2}>
                    <Typography variant="subtitle1" style={{ fontWeight: 'bold' }}>
                      {item.isDirty && <span style={{ color: 'red', marginRight: '4px' }}>*</span>}
                      {item.label}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">{item.description}</Typography>
                  </Box>
                  <Box flex={1} display="flex" justifyContent="flex-end">
                    {item.type === 'BOOLEAN' && (
                      <Switch 
                        checked={Boolean(item.value)} 
                        onChange={(e) => handleChange(item.key, e.target.checked)} 
                        inputProps={{ 'aria-label': item.label }}
                      />
                    )}
                    {item.type === 'STRING' && (
                      <TextField 
                        value={String(item.value || '')} 
                        onChange={(e) => handleChange(item.key, e.target.value)}
                        variant="outlined"
                        size="small"
                        inputProps={{ 'aria-label': item.label }}
                      />
                    )}
                    {item.type === 'NUMBER' && (
                      <TextField 
                        type="number"
                        value={Number(item.value || 0)} 
                        onChange={(e) => handleChange(item.key, Number(e.target.value))}
                        variant="outlined"
                        size="small"
                        inputProps={{ 'aria-label': item.label }}
                      />
                    )}
                    {item.type === 'SELECT' && item.options && (
                      <Select 
                        value={String(item.value)} 
                        onChange={(e) => handleChange(item.key, e.target.value)}
                        variant="outlined"
                        inputProps={{ 'aria-label': item.label }}
                      >
                        {item.options.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    )}
                  </Box>
                </Box>
              ))}
            </Paper>

            <Box mt={2} display="flex" justifyContent="space-between">
              <Button 
                variant="contained" 
                color="primary" 
                onClick={onSave}
                disabled={!items.some(i => i.isDirty)}
              >
                Save
              </Button>
            </Box>
            
            <AddSettingDialog 
              open={dialogOpen} 
              onClose={() => setDialogOpen(false)} 
              onSave={onAddSetting} 
            />
          </Box>
        )}
      </Content>
    </Page>
  );
};
