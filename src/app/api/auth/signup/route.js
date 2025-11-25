import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const { username, password, fullname } = await request.json();

    const normalizedUsername = username?.trim();
    const normalizedFullname = fullname?.trim();
    if (!normalizedUsername || !password || !normalizedFullname) {
      return NextResponse.json(
        { error: 'Full name, username, and password are required' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (username, fullname, password_hash) VALUES ($1, $2, $3) RETURNING user_id, username, fullname, created_at',
      [normalizedUsername, normalizedFullname, passwordHash]
    );

    return NextResponse.json(
      { user: result.rows[0], message: 'Account created' },
      { status: 201 }
    );
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    console.error('Signup error', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
