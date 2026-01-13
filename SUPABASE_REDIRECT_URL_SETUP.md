# Supabase Redirect URL Setup

## Where to Add Redirect URLs in Supabase

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Select your project**
3. **Navigate to**: Authentication → URL Configuration
4. **Add these URLs to "Redirect URLs"**:

### Development (Local)
```
http://localhost:3000/auth/callback
```

### Production (when deployed)
```
https://yourdomain.com/auth/callback
```

### Additional URLs (if using custom domains)
```
https://www.yourdomain.com/auth/callback
```

## Site URL

Also set the **Site URL** to:
- Development: `http://localhost:3000`
- Production: `https://yourdomain.com`

## Important Notes

- **Redirect URLs** are for OAuth callbacks (Google, GitHub, etc.) and email confirmations
- **Site URL** is the base URL of your application
- Make sure to click **Save** after adding URLs
- Changes take effect immediately (no deployment needed)

## Testing

After adding the redirect URL:
1. Try signing up with email
2. Check your email for confirmation link
3. Click the link - it should redirect to `/auth/callback` then to `/ideas`
4. If using Google OAuth, the redirect should work automatically


