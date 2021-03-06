import { ManifestResource, Resource, Utils } from 'manifesto.js/dist-esmodule';
import getThumbnail from '../../../src/lib/ThumbnailFactory';
import fixture from '../../fixtures/version-2/019.json';

const manifest = Utils.parseManifest(fixture);
const canvas = manifest.getSequences()[0].getCanvases()[0];

/** */
function createSubject(jsonld, iiifOpts) {
  return getThumbnail(new ManifestResource(jsonld, {}), iiifOpts);
}

/** */
function createImageSubject(jsonld, iiifOpts) {
  return getThumbnail(new Resource(jsonld, {}), iiifOpts);
}

/** */
function iiifService(url, props = {}, serviceProps = {}) {
  return ({
    id: 'arbitrary-url',
    ...props,
    service: [
      {
        id: url,
        profile: 'level0',
        type: 'ImageService3',
        ...serviceProps,
      },
    ],
  });
}

describe('getThumbnail', () => {
  const url = 'http://example.com';
  const iiifLevel0Service = iiifService(url, {}, { profile: 'level0' });
  const iiifLevel1Service = iiifService(url, { height: 2000, width: 1000 }, { profile: 'level1' });
  const iiifLevel2Service = iiifService(url, { height: 2000, width: 1000 }, { profile: 'level2' });

  describe('with a thumbnail', () => {
    it('return the thumbnail and metadata', () => {
      expect(createSubject({ '@id': 'xyz', '@type': 'Whatever', thumbnail: { '@id': url, height: 70, width: 50 } })).toMatchObject({ height: 70, url, width: 50 });
    });

    it('return the IIIF service of the thumbnail', () => {
      expect(createSubject({ '@id': 'xyz', '@type': 'Whatever', thumbnail: iiifLevel1Service })).toMatchObject({ url: `${url}/full/,120/0/default.jpg` });
    });

    describe('with image size constraints', () => {
      it('does nothing with a static resource', () => {
        expect(createSubject({ '@id': 'xyz', '@type': 'Whatever', thumbnail: { '@id': url } }, { maxWidth: 50 })).toMatchObject({ url });
      });

      it('does nothing with a IIIF level 0 service', () => {
        expect(createSubject({ '@id': 'xyz', '@type': 'Whatever', thumbnail: iiifLevel0Service }, { maxWidth: 50 })).toMatchObject({ url: 'arbitrary-url' });
      });

      it('calculates constraints for a IIIF level 1 service', () => {
        expect(createSubject({ '@id': 'xyz', '@type': 'Whatever', thumbnail: iiifLevel1Service }, { maxWidth: 150 })).toMatchObject({ height: 300, url: `${url}/full/150,/0/default.jpg`, width: 150 });
      });

      it('calculates constraints for a IIIF level 2 service', () => {
        expect(createSubject({ '@id': 'xyz', '@type': 'Whatever', thumbnail: iiifLevel2Service }, { maxHeight: 200, maxWidth: 150 })).toMatchObject({ height: 200, url: `${url}/full/!150,200/0/default.jpg`, width: 100 });
      });

      it('applies a minumum size to image constraints to encourage asset reuse', () => {
        expect(createSubject({ '@id': 'xyz', '@type': 'Whatever', thumbnail: iiifLevel2Service }, { maxHeight: 100, maxWidth: 100 })).toMatchObject({ height: 120, url: `${url}/full/!120,120/0/default.jpg`, width: 60 });
      });
    });
  });

  describe('with an image resource', () => {
    describe('without a IIIF service', () => {
      it('uses the thumbnail', () => {
        expect(createImageSubject({ '@id': 'xyz', '@type': 'Image', thumbnail: { '@id': url, height: 70, width: 50 } })).toMatchObject({ height: 70, url, width: 50 });
      });
    });

    describe('with a level 0 IIIF service', () => {
      it('returns the image', () => {
        expect(createImageSubject({
          ...iiifLevel0Service,
          id: 'xyz',
          type: 'Image',
        })).toMatchObject({ url: 'xyz' });
      });
    });

    describe('with a IIIF service', () => {
      it('prefers the image service over a non-IIIF thumbnail', () => {
        expect(createImageSubject({
          ...iiifLevel1Service,
          id: 'xyz',
          thumbnail: { '@id': 'some-url', height: 70, width: 50 },
          type: 'Image',
        })).toMatchObject({ url: `${url}/full/,120/0/default.jpg` });
      });
      it('prefers a IIIF thumbnail over the image service', () => {
        expect(createImageSubject({
          ...(iiifService('some-url', {}, { profile: 'level1' })),
          id: 'xyz',
          thumbnail: { ...iiifLevel1Service },
          type: 'Image',
        })).toMatchObject({ url: `${url}/full/,120/0/default.jpg` });
      });
    });
  });

  describe('with a canvas', () => {
    it('uses the thumbnail', () => {
      expect(createSubject({ ...canvas.__jsonld, thumbnail: { ...iiifLevel1Service } })).toMatchObject({ url: `${url}/full/,120/0/default.jpg` });
    });

    it('uses the first image resource', () => {
      expect(getThumbnail(canvas)).toMatchObject({ url: 'https://stacks.stanford.edu/image/iiif/hg676jb4964%2F0380_796-44/full/,120/0/default.jpg' });
    });
  });

  describe('with a manifest', () => {
    it('uses the thumbnail', () => {
      const manifestWithThumbnail = Utils.parseManifest({
        ...manifest.__jsonld,
        thumbnail: { ...iiifLevel1Service },
      });

      expect(getThumbnail(manifestWithThumbnail)).toMatchObject({ url: `${url}/full/,120/0/default.jpg` });
    });

    it('uses the startCanvas', () => {
      const manifestWithStartCanvas = Utils.parseManifest({ ...manifest.__jsonld, start: { id: 'https://purl.stanford.edu/fr426cg9537/iiif/canvas/fr426cg9537_1' } });
      expect(getThumbnail(manifestWithStartCanvas)).toMatchObject({ url: 'https://stacks.stanford.edu/image/iiif/fr426cg9537%2FSC1094_s3_b14_f17_Cats_1976_0005/full/,120/0/default.jpg' });
    });

    it('uses the first canvas', () => {
      expect(getThumbnail(manifest)).toMatchObject({ url: 'https://stacks.stanford.edu/image/iiif/hg676jb4964%2F0380_796-44/full/,120/0/default.jpg' });
    });
  });

  describe('with a collection', () => {
    it('uses the thumbnail', () => {
      const collection = Utils.parseManifest({
        items: [
          {
            id: 'https://example.org/iiif/1/manifest',
            label: { en: ['Example Manifest 1'] },
            thumbnail: [
              {
                format: 'image/jpeg',
                id: 'https://example.org/manifest1/thumbnail.jpg',
                type: 'Image',
              },
            ],
            type: 'Manifest',
          },
        ],
        thumbnail: { ...iiifLevel1Service },
        type: 'Collection',
      });
      expect(getThumbnail(collection)).toMatchObject({ url: `${url}/full/,120/0/default.jpg` });
    });

    it('uses the first manifest', () => {
      const collection = Utils.parseManifest({
        items: [
          {
            id: 'https://example.org/iiif/1/manifest',
            label: { en: ['Example Manifest 1'] },
            thumbnail: [
              {
                format: 'image/jpeg',
                id: 'https://example.org/manifest1/thumbnail.jpg',
                type: 'Image',
              },
            ],
            type: 'Manifest',
          },
        ],
        type: 'Collection',
      });
      expect(getThumbnail(collection)).toMatchObject({ url: 'https://example.org/manifest1/thumbnail.jpg' });
    });
  });
});
