import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Port pro hashování hesel — testy mohou použít levnou implementaci. */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

/** Argon2id dle spec §15.3 (memoryCost 19 456 KiB, timeCost 2). */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  };

  hash(password: string): Promise<string> {
    return argon2.hash(password, this.options);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
