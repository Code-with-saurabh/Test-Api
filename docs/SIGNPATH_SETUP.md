# Free signing with SignPath Foundation

[SignPath Foundation](https://signpath.org/) provides free code signing for
eligible open-source projects. It removes the Windows **Unknown publisher /
Windows protected your PC** warning because the downloaded installer carries a
trusted Authenticode signature.

SignPath is **not zero-signup**: the project must apply, be approved, and each
release requires manual signing approval. There is no legitimate way to get a
trusted signature without an account or identity verification.

The repository is already prepared for SignPath. The release workflow keeps
working normally while signing is disabled.

## 1. Apply to SignPath Foundation

Apply at <https://signpath.org/>. The project must:

- use an OSI-approved open-source license (this project uses MIT),
- contain no proprietary or malware components,
- be maintained by the team that owns the source repository,
- use MFA for GitHub and SignPath accounts.

## 2. Configure the SignPath project

In the SignPath web UI:

1. Create/open the organization and copy its **organization ID** (GUID).
2. Create a project for `Code-with-saurabh/Test-Api`.
3. Link the **GitHub** trusted build system and enable origin verification.
4. Create a signing policy, for example `release-signing`.
5. Upload or recreate the artifact configuration from
   [`.signpath/artifact-configuration.xml`](../.signpath/artifact-configuration.xml)
   and note its slug. Suggested slug: `testapi-windows-installer`.
6. Make sure the installer metadata matches the configuration:
   `ProductName = TestApi`, `CompanyName = Saurabh Sharma`.
7. Create an API token with permission to submit signing requests.

## 3. Add GitHub secrets and variables

Repository → **Settings → Secrets and variables → Actions**.

Secret:

| Name | Value |
| --- | --- |
| `SIGNPATH_API_TOKEN` | SignPath API token |

Variables:

| Name | Value |
| --- | --- |
| `SIGNPATH_ENABLED` | `true` |
| `SIGNPATH_ORGANIZATION_ID` | SignPath organization GUID |
| `SIGNPATH_PROJECT_SLUG` | SignPath project slug |
| `SIGNPATH_SIGNING_POLICY_SLUG` | `release-signing` (or your policy slug) |
| `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` | `testapi-windows-installer` (or your slug) |

When `SIGNPATH_ENABLED` is not `true`, the workflow stays unsigned and does not
contact SignPath.

## 4. Release

Push a version tag as usual:

```bash
git tag v1.0.3
git push origin v1.0.3
```

The Windows job will:

1. Build the normal NSIS installer.
2. Upload it to a temporary GitHub artifact.
3. Submit it to SignPath and wait for approval.
4. Replace the unsigned installer with the signed one.
5. Regenerate `latest.yml` and the `.blockmap` so auto-update still works.
6. Fail the build if the returned signature is not `Valid`.

Approve the request in SignPath when it appears. The release is published after
signing completes.

## 5. Verify

Download the installer from the release and run:

```powershell
Get-AuthenticodeSignature .\TestApi-*-win-x64.exe | Format-List Status,SignerCertificate
```

`Status` must be `Valid`, and the signer should be the SignPath Foundation
certificate. Windows SmartScreen should then show the project/publisher instead
of **Unknown publisher**. Reputation can still take a short time for a brand-new
certificate.

## Notes

- SignPath signs the installer; the app inside the NSIS package is not modified.
  Windows checks the installer signature for the download warning.
- The workflow regenerates `latest.yml` and the blockmap after signing so
  electron-updater accepts the new file hash.
- If you later buy an OV/EV certificate, use the `WIN_CSC_LINK` /
  `WIN_CSC_KEY_PASSWORD` path in [CODE_SIGNING.md](CODE_SIGNING.md) instead of
  SignPath.
