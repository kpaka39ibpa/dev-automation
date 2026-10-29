FROM nginx:alpine

WORKDIR /usr/share/nginx/html

# Очищаем дефолтный Nginx
RUN rm -rf ./*

# Копируем только чистые фронтенд-файлы из avertizare
COPY avertizare/ ./

# Автоматический редирект на картографический viewer при входе на http://localhost:8080
RUN echo '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=viewer.html"></head></html>' > index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
