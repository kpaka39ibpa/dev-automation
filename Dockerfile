FROM nginx:alpine

WORKDIR /usr/share/nginx/html

# Очищаем стандартные файлы Nginx
RUN rm -rf ./*

# Копируем всё содержимое из подпапки avertizare
COPY avertizare/ ./

# Создаем индексный редирект на viewer.html
RUN echo '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=viewer.html"></head></html>' > index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
