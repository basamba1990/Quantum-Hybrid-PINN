import asyncio
import aiohttp
import logging
import os
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("keep-alive")

# URLs des services à maintenir éveillés
# On peut les configurer via des variables d'environnement sur Render
SERVICES_TO_PING = os.getenv("KEEP_ALIVE_URLS", "").split(",")

async def ping_service(session, url):
    url = url.strip()
    if not url:
        return
    try:
        # Ajout de SSL=False pour éviter les erreurs de certificat sur certains serveurs de test
        async with session.get(url, timeout=15, ssl=False) as response:
            logger.info(f"[{datetime.now()}] Ping {url} - Status: {response.status}")
    except Exception as e:
        logger.error(f"[{datetime.now()}] Failed to ping {url}: {str(e)}")

async def keep_alive_loop():
    if not SERVICES_TO_PING or SERVICES_TO_PING == [""]:
        logger.warning("No services configured for keep-alive. Set KEEP_ALIVE_URLS env var.")
        return

    logger.info(f"Starting keep-alive for: {SERVICES_TO_PING}")
    async with aiohttp.ClientSession() as session:
        while True:
            tasks = [ping_service(session, url) for url in SERVICES_TO_PING]
            await asyncio.gather(*tasks)
            # Render s'endort après 15 min d'inactivité, on ping toutes les 10 min
            await asyncio.sleep(600) 

if __name__ == "__main__":
    asyncio.run(keep_alive_loop())
