import { css } from '@emotion/css';
import React, { ReactNode, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Badge,
  Button,
  Field,
  FieldArray,
  FieldValidationMessage,
  Form,
  IconButton,
  Input,
  InputControl,
  MultiSelect,
  Select,
  Stack,
  Switch,
  useStyles2,
} from '@grafana/ui';
import { MatcherOperator, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { useMuteTimingOptions } from '../../hooks/useMuteTimingOptions';
import { FormAmRoute } from '../../types/amroutes';
import { SupportedPlugin } from '../../types/pluginBridges';
import { matcherFieldOptions } from '../../utils/alertmanager';
import {
  amRouteToFormAmRoute,
  commonGroupByOptions,
  emptyArrayFieldMatcher,
  mapMultiSelectValueToStrings,
  mapSelectValueToString,
  promDurationValidator,
  repeatIntervalValidator,
  stringToSelectableValue,
  stringsToSelectableValues,
} from '../../utils/amroutes';
import { AmRouteReceiver } from '../receivers/grafanaAppReceivers/types';

import { PromDurationInput } from './PromDurationInput';
import { getFormStyles } from './formStyles';
import { routeTimingsFields } from './routeTimingsFields';

export interface AmRoutesExpandedFormProps {
  receivers: AmRouteReceiver[];
  route?: RouteWithID;
  onSubmit: (route: Partial<FormAmRoute>) => void;
  actionButtons: ReactNode;
  defaults?: Partial<FormAmRoute>;
  isReadOnly?: boolean;
}

export const AmRoutesExpandedForm = ({
  actionButtons,
  receivers,
  route,
  onSubmit,
  defaults,
  isReadOnly = false,
}: AmRoutesExpandedFormProps) => {
  const styles = useStyles2(getStyles);
  const formStyles = useStyles2(getFormStyles);
  const [groupByOptions, setGroupByOptions] = useState(stringsToSelectableValues(route?.group_by));
  const muteTimingOptions = useMuteTimingOptions();
  const emptyMatcher = [{ name: '', operator: MatcherOperator.equal, value: '' }];

  const receiversWithOnCallOnTop = receivers.sort(onCallFirst);

  const formAmRoute = {
    ...amRouteToFormAmRoute(route),
    ...defaults,
  };

  const defaultValues: Omit<FormAmRoute, 'routes'> = {
    ...formAmRoute,
    // if we're adding a new route, show at least one empty matcher
    object_matchers: route ? formAmRoute.object_matchers : emptyMatcher,
  };

  return (
    <Form defaultValues={defaultValues} onSubmit={onSubmit} maxWidth="none">
      {({ control, register, errors, setValue, watch, getValues }) => (
        <>
          <input type="hidden" {...register('id')} />
          {/* @ts-ignore-check: react-hook-form made me do this */}
          <FieldArray name="object_matchers" control={control}>
            {({ fields, append, remove }) => (
              <>
                <Stack direction="column" alignItems="flex-start">
                  <div>Matching labels</div>
                  {fields.length === 0 && (
                    <Badge
                      color="orange"
                      className={styles.noMatchersWarning}
                      icon="exclamation-triangle"
                      text="If no matchers are specified, this notification policy will handle all alert instances."
                    />
                  )}
                  {fields.length > 0 && (
                    <div className={styles.matchersContainer}>
                      {fields.map((field, index) => {
                        return (
                          <Stack direction="row" key={field.id} alignItems="center">
                            <Field
                              label="Label"
                              invalid={!!errors.object_matchers?.[index]?.name}
                              error={errors.object_matchers?.[index]?.name?.message}
                            >
                              <Input
                                {...register(`object_matchers.${index}.name`, { required: 'Field is required' })}
                                defaultValue={field.name}
                                placeholder="label"
                                disabled={isReadOnly}
                                autoFocus
                              />
                            </Field>
                            <Field label={'Operator'}>
                              <InputControl
                                render={({ field: { onChange, ref, ...field } }) => (
                                  <Select
                                    {...field}
                                    className={styles.matchersOperator}
                                    onChange={(value) => onChange(value?.value)}
                                    options={matcherFieldOptions}
                                    aria-label="Operator"
                                    disabled={isReadOnly}
                                  />
                                )}
                                defaultValue={field.operator}
                                control={control}
                                name={`object_matchers.${index}.operator`}
                                rules={{ required: { value: true, message: 'Required.' } }}
                              />
                            </Field>
                            <Field
                              label="Value"
                              invalid={!!errors.object_matchers?.[index]?.value}
                              error={errors.object_matchers?.[index]?.value?.message}
                            >
                              <Input
                                {...register(`object_matchers.${index}.value`, { required: 'Field is required' })}
                                defaultValue={field.value}
                                placeholder="value"
                                disabled={isReadOnly}
                              />
                            </Field>

                            {!isReadOnly && (
                              <IconButton tooltip="Remove matcher" name={'trash-alt'} onClick={() => remove(index)}>
                                Remove
                              </IconButton>
                            )}
                          </Stack>
                        );
                      })}
                    </div>
                  )}
                  {!isReadOnly && (
                    <Button
                      className={styles.addMatcherBtn}
                      icon="plus"
                      onClick={() => append(emptyArrayFieldMatcher)}
                      variant="secondary"
                      type="button"
                    >
                      Add matcher
                    </Button>
                  )}
                </Stack>
              </>
            )}
          </FieldArray>
          <Field label="Contact point">
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <Select
                  aria-label="Contact point"
                  {...field}
                  className={formStyles.input}
                  onChange={(value) => onChange(mapSelectValueToString(value))}
                  options={receiversWithOnCallOnTop}
                  isClearable
                  disabled={isReadOnly}
                />
              )}
              control={control}
              name="receiver"
            />
          </Field>
          <Field label="Continue matching subsequent sibling nodes">
            <Switch id="continue-toggle" {...register('continue')} disabled={isReadOnly} />
          </Field>
          <Field label="Override grouping">
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <Switch id="override-grouping-toggle" {...field} disabled={isReadOnly} onChange={onChange} />
              )}
              control={control}
              name="overrideGrouping"
            />
          </Field>
          {watch().overrideGrouping && (
            <Field
              label="Group by"
              description="Group alerts when you receive a notification based on labels. If empty it will be inherited from the parent policy."
            >
              <InputControl
                rules={{
                  validate: (value) => {
                    if (!value || value.length === 0) {
                      return 'At least one group by option is required.';
                    }
                    return true;
                  },
                }}
                render={({ field: { onChange, ref, ...field }, fieldState: { error } }) => (
                  <>
                    <MultiSelect
                      aria-label="Group by"
                      {...field}
                      invalid={Boolean(error)}
                      allowCustomValue
                      className={formStyles.input}
                      onCreateOption={(opt: string) => {
                        setGroupByOptions((opts) => [...opts, stringToSelectableValue(opt)]);

                        // @ts-ignore-check: react-hook-form made me do this
                        setValue('groupBy', [...field.value, opt]);
                      }}
                      onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
                      options={[...commonGroupByOptions, ...groupByOptions]}
                      disabled={isReadOnly}
                    />
                    {error && <FieldValidationMessage>{error.message}</FieldValidationMessage>}
                  </>
                )}
                control={control}
                name="groupBy"
              />
            </Field>
          )}
          <Field label="Override general timings">
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <Switch data-testid="override-timings-toggle" {...field} disabled={isReadOnly} onChange={onChange} />
              )}
              control={control}
              name="overrideTimings"
            />
          </Field>
          {watch().overrideTimings && (
            <>
              <Field
                label={routeTimingsFields.groupWait.label}
                description={routeTimingsFields.groupWait.description}
                invalid={!!errors.groupWaitValue}
                error={errors.groupWaitValue?.message}
              >
                <PromDurationInput
                  {...register('groupWaitValue', { validate: promDurationValidator })}
                  aria-label={routeTimingsFields.groupWait.ariaLabel}
                  className={formStyles.promDurationInput}
                  disabled={isReadOnly}
                />
              </Field>
              <Field
                label={routeTimingsFields.groupInterval.label}
                description={routeTimingsFields.groupInterval.description}
                invalid={!!errors.groupIntervalValue}
                error={errors.groupIntervalValue?.message}
                disabled={isReadOnly}
              >
                <PromDurationInput
                  {...register('groupIntervalValue', { validate: promDurationValidator })}
                  aria-label={routeTimingsFields.groupInterval.ariaLabel}
                  className={formStyles.promDurationInput}
                  disabled={isReadOnly}
                />
              </Field>
              <Field
                label={routeTimingsFields.repeatInterval.label}
                description={routeTimingsFields.repeatInterval.description}
                invalid={!!errors.repeatIntervalValue}
                error={errors.repeatIntervalValue?.message}
              >
                <PromDurationInput
                  {...register('repeatIntervalValue', {
                    validate: (value: string) => {
                      const groupInterval = getValues('groupIntervalValue');
                      return repeatIntervalValidator(value, groupInterval);
                    },
                  })}
                  aria-label={routeTimingsFields.repeatInterval.ariaLabel}
                  className={formStyles.promDurationInput}
                  disabled={isReadOnly}
                />
              </Field>
            </>
          )}
          <Field
            label="Mute timings"
            data-testid="am-mute-timing-select"
            description="Add mute timing to policy"
            invalid={!!errors.muteTimeIntervals}
          >
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <MultiSelect
                  aria-label="Mute timings"
                  {...field}
                  className={formStyles.input}
                  onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
                  options={muteTimingOptions}
                  disabled={isReadOnly}
                />
              )}
              control={control}
              name="muteTimeIntervals"
            />
          </Field>
          {actionButtons}
        </>
      )}
    </Form>
  );
};

function onCallFirst(receiver: AmRouteReceiver) {
  if (receiver.grafanaAppReceiverType === SupportedPlugin.OnCall) {
    return -1;
  } else {
    return 0;
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  const commonSpacing = theme.spacing(3.5);

  return {
    addMatcherBtn: css`
      margin-bottom: ${commonSpacing};
    `,
    matchersContainer: css`
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(1.5)} ${theme.spacing(2)};
      padding-bottom: 0;
      width: fit-content;
    `,
    matchersOperator: css`
      min-width: 120px;
    `,
    noMatchersWarning: css`
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
      margin-bottom: ${theme.spacing(1)};
    `,
  };
};
