export const AUTH_TOKEN_KEY = 'code_shield_token';

/**
 * 在 Portal 主应用中，由于是根路由，导航路径无需添加任何微前端 BASE_PATH 前缀
 */
export function appNavigatePath(path: string): string {
  return path;
}
