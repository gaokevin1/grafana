import {
  ByNamesMatcherMode,
  DataFrame,
  DynamicConfigValue,
  FieldConfigSource,
  FieldMatcherID,
  FieldType,
  getFieldDisplayName,
  isSystemOverrideWithRef,
  SystemConfigOverrideRule,
} from '@grafana/data';
import { GraphNGLegendEventMode } from '@grafana/ui';

const displayOverrideRef = 'hideSeriesFrom';
const isHideSeriesOverride = isSystemOverrideWithRef(displayOverrideRef);

export function seriesVisibilityConfigFactory(
  label: string,
  mode: GraphNGLegendEventMode,
  fieldConfig: FieldConfigSource,
  data: DataFrame[]
) {
  const { overrides } = fieldConfig;

  const displayName = label;
  const currentIndex = overrides.findIndex(isHideSeriesOverride);

  if (currentIndex < 0) {
    if (mode === GraphNGLegendEventMode.ToggleSelection) {
      const override = createOverride([displayName]);

      return {
        ...fieldConfig,
        overrides: [override, ...fieldConfig.overrides],
      };
    }

    const displayNames = getDisplayNames(data, displayName);
    const override = createOverride(displayNames);

    return {
      ...fieldConfig,
      overrides: [override, ...fieldConfig.overrides],
    };
  }

  const overridesCopy = Array.from(overrides);
  const [current] = overridesCopy.splice(currentIndex, 1) as SystemConfigOverrideRule[];

  if (mode === GraphNGLegendEventMode.ToggleSelection) {
    const existing = getExistingDisplayNames(current);

    if (existing[0] === displayName && existing.length === 1) {
      return {
        ...fieldConfig,
        overrides: overridesCopy,
      };
    }

    const override = createOverride([displayName]);

    return {
      ...fieldConfig,
      overrides: [override, ...overridesCopy],
    };
  }

  const override = createExtendedOverride(current, displayName);

  if (allFieldsAreExcluded(override, data)) {
    return {
      ...fieldConfig,
      overrides: overridesCopy,
    };
  }

  return {
    ...fieldConfig,
    overrides: [override, ...overridesCopy],
  };
}

function createOverride(
  names: string[],
  mode = ByNamesMatcherMode.exclude,
  property?: DynamicConfigValue
): SystemConfigOverrideRule {
  property = property ?? {
    id: 'custom.hideFrom',
    value: {
      viz: true,
      legend: false,
      tooltip: false,
    },
  };

  return {
    __systemRef: displayOverrideRef,
    matcher: {
      id: FieldMatcherID.byNames,
      options: {
        mode: mode,
        names: names,
        prefix: mode === ByNamesMatcherMode.exclude ? 'All except:' : undefined,
        readOnly: true,
      },
    },
    properties: [
      {
        ...property,
        value: {
          viz: true,
          legend: false,
          tooltip: false,
        },
      },
    ],
  };
}

const createExtendedOverride = (
  current: SystemConfigOverrideRule,
  displayName: string,
  mode = ByNamesMatcherMode.exclude
): SystemConfigOverrideRule => {
  const property = current.properties.find((p) => p.id === 'custom.hideFrom');
  const existing = getExistingDisplayNames(current);
  const index = existing.findIndex((name) => name === displayName);

  if (index < 0) {
    existing.push(displayName);
  } else {
    existing.splice(index, 1);
  }

  return createOverride(existing, mode, property);
};

const getExistingDisplayNames = (rule: SystemConfigOverrideRule): string[] => {
  const names = rule.matcher.options?.names;
  if (!Array.isArray(names)) {
    return [];
  }
  return names;
};

const allFieldsAreExcluded = (override: SystemConfigOverrideRule, data: DataFrame[]): boolean => {
  return getExistingDisplayNames(override).length === getDisplayNames(data).length;
};

const getDisplayNames = (data: DataFrame[], excludeName?: string): string[] => {
  const unique = new Set<string>();

  for (const frame of data) {
    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }

      const name = getFieldDisplayName(field, frame, data);

      if (name === excludeName) {
        continue;
      }

      unique.add(name);
    }
  }

  return Array.from(unique);
};
