import flatten from 'lodash/flatten';
import flattenDeep from 'lodash/flattenDeep';
import { Canvas } from 'manifesto.js';
/**
 * MiradorCanvas - adds additional, testable logic around Manifesto's Canvas
 * https://iiif-commons.github.io/manifesto/classes/_canvas_.manifesto.canvas.html
 */
export default class MiradorCanvas {
  /**
   * @param {MiradorCanvas} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
  }

  /** */
  get id() {
    return this.canvas.id;
  }

  /** */
  getWidth() {
    return this.canvas.getWidth();
  }

  /** */
  getHeight() {
    return this.canvas.getHeight();
  }

  /**
   */
  get aspectRatio() {
    return this.canvas.getWidth() / this.canvas.getHeight();
  }

  /**
   * Fetches AnnotationList URIs from canvas's otherContent property
   *
   * Supported otherContent types:
   * - Objects having @type property of "sc:AnnotationList" and URI in @id
   * - Strings being the URIs
   */
  get annotationListUris() {
    return flatten(
      new Array(this.canvas.__jsonld.otherContent), // eslint-disable-line no-underscore-dangle
    )
      .filter(otherContent => otherContent && (typeof otherContent === 'string' || otherContent['@type'] === 'sc:AnnotationList'))
      .map(otherContent => (typeof otherContent === 'string' ? otherContent : otherContent['@id']));
  }

  /** */
  get canvasAnnotationPages() {
    return flatten(
      new Array(this.canvas.__jsonld.annotations), // eslint-disable-line no-underscore-dangle
    )
      .filter(annotations => annotations && annotations.type === 'AnnotationPage');
  }

  /** */
  processAnnotations(fetchAnnotation, receiveAnnotation) {
    // IIIF v2
    this.annotationListUris.forEach((uri) => {
      fetchAnnotation(this.canvas.id, uri);
    });
    // IIIF v3
    this.canvasAnnotationPages.forEach((annotation) => {
      // If there are no items, try to retrieve the referenced resource.
      // otherwise the resource should be embedded and just add to the store.
      if (!annotation.items) {
        fetchAnnotation(this.canvas.id, annotation.id);
      } else {
        receiveAnnotation(this.canvas.id, annotation.id, annotation);
      }
    });
  }

  /**
   * Will negotiate a v2 or v3 type of resource
   */
  get imageResource() {
    return this.imageResources[0];
  }

  /** */
  get imageResources() {
    const resources = flattenDeep([
      this.canvas.getImages().map(i => i.getResource()),
      this.canvas.getContent().map(i => i.getBody()),
    ]);

    return flatten(resources.map((resource) => {
      switch (resource.getProperty('type')) {
        case 'oa:Choice':
          return new Canvas({ images: flatten([resource.getProperty('default'), resource.getProperty('item')]).map(r => ({ resource: r })) }, this.canvas.options).getImages().map(i => i.getResource());
        default:
          return resource;
      }
    }));
  }

  /** */
  get resourceAnnotations() {
    return flattenDeep([
      this.canvas.getImages(),
      this.canvas.getContent(),
    ]);
  }

  /**
   * Returns a given resource Annotation, based on a contained resource or body
   * id
   */
  resourceAnnotation(id) {
    return this.resourceAnnotations.find(
      anno => anno.getResource().id === id || anno.getBody().id === id,
    );
  }

  /**
   * Returns the fragment placement values if a resourceAnnotation is placed on
   * a canvas somewhere besides the full extent
   */
  onFragment(id) {
    const resourceAnnotation = this.resourceAnnotation(id);
    if (!resourceAnnotation) return undefined;
    const fragmentMatch = resourceAnnotation.getProperty('on').match(/xywh=(.*)$/);
    if (!fragmentMatch) return undefined;
    return fragmentMatch[1].split(',').map(str => parseInt(str, 10));
  }

  /** */
  get iiifImageResources() {
    return this.imageResources
      .filter(r => r && r.getServices()[0] && r.getServices()[0].id);
  }

  /** */
  get imageServiceIds() {
    return this.iiifImageResources.map(r => r.getServices()[0].id);
  }

  /**
   * Get the canvas service
   */
  get service() {
    return this.canvas.__jsonld.service; // eslint-disable-line no-underscore-dangle
  }

  /**
   * Get the canvas label
   */
  getLabel() {
    return this.canvas.getLabel().length > 0
      ? this.canvas.getLabel().map(label => label.value)[0]
      : String(this.canvas.index + 1);
  }
}
