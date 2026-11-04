// Site-wide settings. Change these when the domain / repo are final.
export const SITE_URL = "https://presenterlist.org";
export const SITE_NAME = "PresenterList";
export const SITE_DESCRIPTION =
  "The open directory of church presentation software. Compare ProPresenter, EasyWorship, OpenLP, FreeShow and more by price, platform and features.";
export const REPO_URL = "https://github.com/Vija02/presenterlist";

export const newProductIssueUrl = `${REPO_URL}/issues/new?template=new-product.yml`;
export const editProductIssueUrl = (name: string, slug: string) =>
  `${REPO_URL}/issues/new?template=edit-product.yml&title=${encodeURIComponent(`Edit: ${name}`)}&product=${encodeURIComponent(slug)}`;
export const editFileUrl = (slug: string) => `${REPO_URL}/edit/main/src/data/products/${slug}.yaml`;
export const newsIssueUrl = `${REPO_URL}/issues/new?template=release.yml`;
