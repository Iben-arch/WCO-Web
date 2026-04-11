using System.Collections.Generic;
using Microsoft.IdentityModel.Tokens;

namespace ServerApi.Authentication;

/// <summary>
/// เก็บคีย์สำหรับตรวจ Supabase JWT: HS256 (legacy JWT secret) และ ES256/RS256 จาก JWKS
/// </summary>
public sealed class SupabaseJwtValidationState
{
    private readonly object _lock = new();
    private IReadOnlyList<SecurityKey> _jwksKeys;

    public SupabaseJwtValidationState(SymmetricSecurityKey? symmetricKey, IReadOnlyList<SecurityKey> initialJwksKeys)
    {
        SymmetricKey = symmetricKey;
        _jwksKeys = initialJwksKeys;
    }

    public SymmetricSecurityKey? SymmetricKey { get; }

    public IReadOnlyList<SecurityKey> JwksKeys
    {
        get
        {
            lock (_lock)
                return _jwksKeys;
        }
    }

    public void ReplaceJwks(IReadOnlyList<SecurityKey> keys)
    {
        lock (_lock)
            _jwksKeys = keys;
    }
}
