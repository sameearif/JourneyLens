import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    const normalizedUsername = username?.trim();

    if (!normalizedUsername || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const userResult = await query(
      'SELECT user_id, username, fullname, password_hash, created_at FROM users WHERE username = $1',
      [normalizedUsername]
    );

    if (!userResult.rowCount) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const user = userResult.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const { password_hash, ...safeUser } = user;
    return NextResponse.json({ user: safeUser, message: 'Login successful' });
  } catch (error) {
    console.error('Login error', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}
