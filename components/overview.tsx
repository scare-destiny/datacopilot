import { motion } from 'framer-motion'
import Link from 'next/link'

import { MessageIcon, DataCopilotIcon } from './icons'

export const Overview = () => {
	return (
		<motion.div
			key='overview'
			className='max-w-3xl mx-auto md:mt-20'
			initial={{ opacity: 0, scale: 0.98 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.98 }}
			transition={{ delay: 0.5 }}
		>
			<div className='rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-xl'>
				<p className='flex flex-row justify-center gap-4 items-center'>
					<motion.div
						animate={{
							boxShadow: [
								'0 0 10px rgba(59, 130, 246, 0.5)',
								'0 0 20px rgba(59, 130, 246, 0.3)',
								'0 0 10px rgba(59, 130, 246, 0.5)',
							],
						}}
						transition={{
							duration: 2,
							repeat: Infinity,
						}}
						className='rounded-full'
					>
						<DataCopilotIcon size={46} />
					</motion.div>
					{/* <span>+</span>
					<MessageIcon size={32} /> */}
				</p>
				<p>
					Turn Complex Data Into Clear Decisions. Stop wrestling with SQL queries and
					complex analytics tools. DataCopilot is your smart data companion that
					speaks human, not tech.
				</p>
				<p>
					Stop relying on analysts and feel empowered yourself. Build queries in
					plain English, and get instant insights that drive you forward.
				</p>
			</div>
		</motion.div>
	)
}
