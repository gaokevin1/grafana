import React, { useState } from 'react';

import { NavModelItem } from '@grafana/data';
import { Button, Field, Form, Input, InputControl, LinkButton, Select, Stack, Switch } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { SSOProviderDTO } from './types';

const pageNav: NavModelItem = {
  text: 'GitHub',
  subTitle:
    'To configure GitHub OAuth2 you must register your application with GitHub. GitHub will generate a Client ID and Client Secret for you to use.',
  icon: 'github',
  id: 'GitHub',
};
type ProviderData = Pick<SSOProviderDTO, 'clientId' | 'clientSecret' | 'enabled' | 'teamIds' | 'allowedOrganizations'>;
const defaultValues: ProviderData = {
  clientId: '',
  clientSecret: '',
  enabled: false,
  teamIds: [],
  allowedOrganizations: [],
};
export const GitHubConfig = () => {
  const [isSaving, setIsSaving] = useState(false);
  const handleSubmit = async (data: ProviderData) => {
    setIsSaving(true);
    try {
      // Simulating an asynchronous operation with a setTimeout
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Show a success banner using AppEvents,
      // https://developers.grafana.com/ui/canary/index.html?path=/docs/overlays-alert-toast--docs#dos-1
    } catch (error) {
      // Show an error banner using AppEvents,
      // https://developers.grafana.com/ui/canary/index.html?path=/docs/overlays-alert-toast--docs#dos-1
      console.error('Error during async operation:', error);
    } finally {
      // This block will be executed regardless of success or failure
      setIsSaving(false);
    }
  };

  return (
    <Page navId="authentication" pageNav={pageNav}>
      <Page.Contents>
        <Stack grow={1} direction={'column'}>
          <Form onSubmit={handleSubmit} defaultValues={defaultValues}>
            {({ register, errors, control, setValue, watch }) => {
              const teamIdOptions = watch('teamIds');
              const orgOptions = watch('allowedOrganizations');
              return (
                <>
                  <Field label="Enabled">
                    <Switch {...register('enabled')} id="enabled" />
                  </Field>
                  <Field label="Client ID" required invalid={!!errors.clientId} error="This field is required">
                    <Input {...register('clientId', { required: true })} type="text" id="text" />
                  </Field>
                  <Field label="Client secret" required invalid={!!errors.clientId} error="This field is required">
                    <Input {...register('clientSecret', { required: true })} type="text" id="text" />
                  </Field>
                  <Field label="Team IDs">
                    <InputControl
                      name={'teamIds'}
                      control={control}
                      render={({ field: { ref, onChange, ...fieldProps } }) => {
                        return (
                          <Select
                            {...fieldProps}
                            placeholder={'Enter team IDs and press Enter to add'}
                            isMulti
                            options={teamIdOptions}
                            allowCustomValue
                            onChange={onChange}
                            onCreateOption={(v) => {
                              const customValue = { value: v, label: v };
                              onChange([...teamIdOptions, customValue]);
                            }}
                          />
                        );
                      }}
                    />
                  </Field>

                  <Field label="Allowed organizations">
                    <InputControl
                      name={'allowedOrganizations'}
                      control={control}
                      render={({ field: { ref, onChange, ...fieldProps } }) => {
                        return (
                          <Select
                            {...fieldProps}
                            placeholder={'Enter organizations (my-team, myteam...) and press Enter to add'}
                            isMulti
                            options={orgOptions}
                            allowCustomValue
                            onChange={onChange}
                            onCreateOption={(v) => {
                              const customValue = { value: v, label: v };
                              onChange([...orgOptions, customValue]);
                            }}
                          />
                        );
                      }}
                    />
                  </Field>
                  <Stack gap={2}>
                    <Field>
                      <Button type={'submit'}>{isSaving ? 'Saving...' : 'Save'}</Button>
                    </Field>
                    <Field>
                      <LinkButton href={'/admin/authentication'} variant={'secondary'}>
                        Discard
                      </LinkButton>
                    </Field>
                  </Stack>
                </>
              );
            }}
          </Form>
        </Stack>
      </Page.Contents>
    </Page>
  );
};

export default GitHubConfig;
