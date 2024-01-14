const express = require('express');

const feedRoutes = require('./routes/feed');

const app = express();

// handles all routed requests to /feed/
app.use('/feed', feedRoutes);

app.listen(8080);
