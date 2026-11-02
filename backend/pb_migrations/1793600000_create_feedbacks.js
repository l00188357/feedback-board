migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "feedbacks",

    // Public reading and submission.
    // Only superusers can update or delete.
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null,
    deleteRule: null,

    fields: [
      {
        type: "text",
        name: "name",
        required: true,
        min: 1,
        max: 60,
      },
      {
        type: "select",
        name: "category",
        required: true,
        maxSelect: 1,
        values: ["Suggestion", "Bug", "Compliment"],
      },
      {
        type: "text",
        name: "message",
        required: true,
        min: 1,
        max: 500,
      },
      {
        type: "autodate",
        name: "created",
        onCreate: true,
        onUpdate: false,
      },
      {
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true,
      },
    ],
  });

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("feedbacks");
  app.delete(collection);
});