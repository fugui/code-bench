import React, { useCallback } from 'react';
import { MemberSearchSelect as CommonMemberSearchSelect, type User, AUTH_TOKEN_KEY } from '@code/common';

export interface MemberSearchSelectProps {
  value: number | string | '';
  onChange: (userId: number | '', selectedUser?: User) => void;
  style?: React.CSSProperties;
}

export default function MemberSearchSelect({ value, onChange, style }: MemberSearchSelectProps) {
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
    <CommonMemberSearchSelect
      value={value}
      onChange={onChange}
      style={style}
      fetchFn={authFetch}
    />
  );
}
