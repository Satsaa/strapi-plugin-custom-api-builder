"use strict";

const { contentTypes: contentTypesUtils } = require("@strapi/utils");
const { has, assoc, mapValues, prop } = require("lodash/fp");
const cloneDeepWith = require("lodash/cloneDeepWith");
const { getConfigObject, getTrimmedStructure } = require("../utils");

const hasEditMainField = has("edit.mainField");
const getEditMainField = prop("edit.mainField");
const assocListMainField = assoc("list.mainField");

const assocMainField = (metadata) =>
  hasEditMainField(metadata)
    ? assocListMainField(getEditMainField(metadata), metadata)
    : metadata;

// retrieve a local service
const getService = (name) => {
  return strapi.plugin("content-manager").service(name);
};

// @todo: refactoring - move all complex logic to services
module.exports = {
  async find(ctx) {
    try {
      return await strapi
        .plugin("custom-api")
        .service("customApiServices")
        .find(ctx.query);
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async findById(ctx) {
    const { id } = ctx.params;
    try {
      return await strapi
        .plugin("custom-api")
        .service("customApiServices")
        .findById(id, ctx.query);
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async findCustomApiStructureBySlug(ctx) {
    const { slug } = ctx.params;

    if (!slug) ctx.throw(500, new Error("Slug Not found"));

    try {
      return await strapi
        .plugin("custom-api")
        .service("customApiServices")
        .findContentTypeBySlug(slug, ctx.query);
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async findCustomAPIDataBySlug(ctx) {
    const structure = await this.findCustomApiStructureBySlug(ctx);

    if (!structure || !structure.length) {
      ctx.throw(
        500,
        new Error("The structure for this custom-api route is not found.")
      );
    }

    let trimmedStructure = getTrimmedStructure(structure);

    // console.log(
    //   "trimmedStructure *** ",
    //   JSON.stringify(trimmedStructure, null, 2)
    // );

    let config = getConfigObject(trimmedStructure);

    // @todo: Provide a way to show this config in the UI to the site builders
    // console.log("config *** ", JSON.stringify(config, null, 2));

    const entries = await strapi.entityService.findMany(
      structure[0]["selectedContentType"]["uid"],
      config
    );

    return entries;
  },

  async create(ctx) {
    try {
      ctx.body = await strapi
        .plugin("custom-api")
        .service("customApiServices")
        .create(ctx.request.body);
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async update(ctx) {
    try {
      ctx.body = await strapi
        .plugin("custom-api")
        .service("customApiServices")
        .update(ctx.params.id, ctx.request.body);
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async findContentTypes(ctx) {
    // const { kind } = ctx.query;

    const contentTypes =
      getService("content-types").findContentTypesByKind("collectionType");
    const { toDto } = getService("data-mapper");
    const contentTypesMappedToDto = contentTypes.map(toDto);
    const filteredContentTypes = contentTypesMappedToDto.filter(
      (item) =>
        item.isDisplayed && item.apiID !== "user" && item.apiID !== "custom-api"
    );

    return filteredContentTypes;
  },

  async findContentTypesSettings(ctx) {
    const { findAllContentTypes, findConfiguration } =
      getService("content-types");

    const contentTypes = await findAllContentTypes();
    const configurations = await Promise.all(
      contentTypes.map(async (contentType) => {
        const { uid, settings } = await findConfiguration(contentType);
        return { uid, settings };
      })
    );

    return configurations;
  },

  async findContentTypeConfiguration(ctx) {
    const { uid } = ctx.params;

    const contentTypeService = getService("content-types");

    const contentType = await contentTypeService.findContentType(uid);

    if (!contentType) {
      return ctx.notFound("contentType.notFound");
    }

    const configuration = await contentTypeService.findConfiguration(
      contentType
    );

    const confWithUpdatedMetadata = {
      ...configuration,
      metadatas: mapValues(assocMainField, configuration.metadatas),
    };

    const components = await contentTypeService.findComponentsConfigurations(
      contentType
    );

    return {
      data: {
        contentType: confWithUpdatedMetadata,
        components,
      },
    };
  },

  // /custom-api/test-em-out-do-not-use
  // for testing purpose at the time of development only.
  async testEmOutDoNotUse(ctx) {
    let configAllAuthors = {
      fields: ["id", "AuthorName", "createdAt"],
      populate: {
        books: {
          fields: ["id", "BookName", "createdAt"],
        },
      },
    };

    let configAuthorsWithImage = {
      fields: ["id", "AuthorName"],
      populate: {
        AuthorImage: {},
      },
    };

    try {
      // fetching data
      const entries = await strapi.entityService.findMany(
        "api::author.author",
        {
          fields: ["id", "AuthorName"],
          populate: {
            hobbies: {
              fields: ["HobbyName"],
            },
            books: {
              fields: ["BookName"],
              populate: {
                book_categories: {
                  fields: ["BookCategoryName"],
                },
              },
            },
          },
        }
      );
      return entries;
    } catch (err) {
      return err;
    }
  },
};
