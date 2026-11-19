import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { EatWellService } from './eat-well.service';

export const sessionGuard: CanActivateChildFn = async route => {
  const service = inject(EatWellService);
  const router = inject(Router);
  try {
    const user = await service.refreshSession();
    const allowedRoles: string[] | undefined = route.data['roles'];
    return !allowedRoles || allowedRoles.includes(user.role ?? 'patient')
      ? true : router.createUrlTree(['/tabs/home']);
  } catch {
    return router.createUrlTree(['/login']);
  }
};
