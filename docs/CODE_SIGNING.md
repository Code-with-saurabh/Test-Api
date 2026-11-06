# Code signing

TestApi installers are unsigned by default. When an installer is downloaded from
GitHub, Windows adds a Mark-of-the-Web and SmartScreen checks its signature and
reputation. Unsigned, newly published executables therefore show **“Windows
protected your PC”** or an **Unknown publisher** prompt. Locally built installers
do not show this because they have no Mark-of-the-Web.

Signing is the only legitimate way to remove that prompt. Do **not** disable
Windows Defender, real-time protection, or add permanent exclusion folders.

## Windows signing

The release workflow already reads two optional repository secrets:

| Secret | Description |
| --- | --- |
| `WIN_CSC_LINK` | Base64-encoded `.pfx`, absolute file path, or HTTPS URL to the certificate |
| `WIN_CSC_KEY_PASSWORD` | Password for the `.pfx` file |

Add them under **GitHub → Settings → Secrets and variables → Actions → New
repository secret**. When `WIN_CSC_LINK` is empty, the build stays unsigned and
continues normally.

Create the base64 value on Windows:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\certificate.pfx")) | Set-Clipboard
```

For local signing, set the environment variables before packaging:

```powershell
$env:WIN_CSC_LINK = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\certificate.pfx"))
$env:WIN_CSC_KEY_PASSWORD = "your-password"
npm run dist:win
```

Verify the result:

```powershell
Get-AuthenticodeSignature .\release\TestApi-*-win-x64.exe | Format-List Status,SignerCertificate
```

`Status` should be `Valid`. New certificates may still need time to build
SmartScreen reputation; EV certificates and Azure Trusted Signing build
reputation faster.

### Certificate options

- **OV/EV code-signing certificate** from a public CA (for example DigiCert,
  Sectigo, SSL.com, or Certum).
- **Azure Trusted Signing** if you meet Microsoft's eligibility requirements;
  sign the generated `.exe` after `electron-builder` finishes.
- **SignPath Foundation** offers free signing for eligible open-source projects.

## Microsoft Defender false positives

If Defender quarantines a build (not just SmartScreen), submit the exact file
for review:

<https://www.microsoft.com/en-us/wdsi/filesubmission>

Include the SHA-256 hash, download URL, and a short description of the app.
After review, Microsoft can update its signatures.

## macOS signing (optional)

The workflow currently leaves macOS unsigned. To sign and notarise later:

1. Add `CSC_LINK` and `CSC_KEY_PASSWORD` for the Apple Developer ID certificate.
2. Add `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`.
3. Enable `hardenedRuntime` in the `mac` section of `package.json`, remove
   `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` from the workflow, and keep
   `gatekeeperAssess: false`.

Until then, macOS users must right-click the app and choose **Open** once.

## What users can do with an unsigned build

Only if they trust the source and have verified the SHA-256 checksum against the
release page:

- Windows SmartScreen: **More info → Run anyway**.
- macOS: right-click the app → **Open**.

Never instruct users to disable antivirus or add broad exclusion paths.
