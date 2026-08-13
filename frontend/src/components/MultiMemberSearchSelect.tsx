import React, { useCallback } from 'react';
import { MultiMemberSearchSelect as CommonMultiMemberSearchSelect, AUTH_TOKEN_KEY } from '@code/common';

export interface MultiMemberSearchSelectProps {
  value: string[];
  onChange: (memberIds: string[]) => void;
  style?: React.CSSProperties;
  maxSelections?: number;
}

export default function MultiMemberSearchSelect({ value = [], onChange, style, maxSelections = 20 }: MultiMemberSearchSelectProps) {
  const authFetch = useCallback((url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY)}`
      }
    });
  }, []);

  return (
    <CommonMultiMemberSearchSelect
      value={value}
      onChange={onChange}
      style={style}
      maxSelections={maxSelections}
      fetchFn={authFetch}
    />
  );
}
